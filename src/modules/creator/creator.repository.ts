import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { CreatorQueryDto, CreatorProfileStatsDto, CreatorApplicationQueryDto } from './creator.dto';

export class CreatorRepository {
  async findApplications(query: CreatorApplicationQueryDto) {
    const { page = 1, limit = 20, search, status = 'PENDING' } = query;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(status === 'ALL'
        ? { creatorStatus: { not: 'NONE' } }
        : { creatorStatus: status }),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { creatorAppliedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          bio: true,
          avatarUrl: true,
          isCreator: true,
          creatorStatus: true,
          creatorAppliedAt: true,
          creatorRejectReason: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        bio: true,
        avatarUrl: true,
        isCreator: true,
        creatorStatus: true,
        creatorAppliedAt: true,
        creatorRejectReason: true,
      },
    });
  }

  async approveApplication(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isCreator: true,
        creatorStatus: 'APPROVED',
        creatorRejectReason: null,
      },
    });
  }

  async rejectApplication(userId: string, reason?: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isCreator: false,
        creatorStatus: 'REJECTED',
        creatorRejectReason: reason || 'Hồ sơ chưa đạt yêu cầu của nền tảng.',
      },
    });
  }

  async revokeCreator(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isCreator: false,
        creatorStatus: 'NONE',
      },
    });
  }
  async getCreatorStats(userId: string): Promise<CreatorProfileStatsDto> {
    const [themesCount, downloadStats, followersCount] = await Promise.all([
      prisma.keyboardTheme.count({
        where: {
          createdBy: userId,
          status: 'PUBLISHED',
        },
      }),
      prisma.keyboardTheme.aggregate({
        where: {
          createdBy: userId,
          status: 'PUBLISHED',
        },
        _sum: {
          downloadCount: true,
          likeCount: true,
        },
      }),
      prisma.userFollow.count({
        where: {
          followingId: userId,
        },
      }),
    ]);

    return {
      themesCount,
      downloadsCount: downloadStats._sum.downloadCount || 0,
      likesCount: downloadStats._sum.likeCount || 0,
      followersCount,
    };
  }

  async findByUsername(username: string) {
    return prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        isCreator: true,
        isFeaturedCreator: true,
        socialLinks: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        isCreator: true,
        isFeaturedCreator: true,
        socialLinks: true,
        createdAt: true,
      },
    });
  }

  async findPublicList(query: CreatorQueryDto) {
    const { page = 1, limit = 20, search, isFeatured, sort = 'TOP_FOLLOWERS' } = query;

    const where: Prisma.UserWhereInput = {
      isCreator: true,
      deletedAt: null,
      username: { not: null },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { bio: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isFeatured !== undefined ? { isFeaturedCreator: isFeatured } : {}),
    };

    let orderBy: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    if (sort === 'TOP_FOLLOWERS') {
      orderBy = [{ followers: { _count: 'desc' } }, { createdAt: 'desc' }];
    } else if (sort === 'TOP_THEMES') {
      orderBy = [{ authoredThemes: { _count: 'desc' } }, { createdAt: 'desc' }];
    } else if (sort === 'NAME_ASC') {
      orderBy = [{ fullName: 'asc' }, { username: 'asc' }];
    } else if (sort === 'NAME_DESC') {
      orderBy = [{ fullName: 'desc' }, { username: 'desc' }];
    } else if (sort === 'LATEST') {
      orderBy = [{ createdAt: 'desc' }];
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const safePage = Math.max(1, Number(page) || 1);
    const skip = (safePage - 1) * safeLimit;

    let users: Array<{
      id: string;
      fullName: string | null;
      username: string | null;
      bio: string | null;
      avatarUrl: string | null;
      bannerUrl: string | null;
      isCreator: boolean;
      isFeaturedCreator: boolean;
      createdAt: Date;
      _count: {
        followers: number;
        authoredThemes: number;
      };
    }>;
    let total: number;

    if (sort === 'TOP_DOWNLOADS') {
      const searchClause = search
        ? Prisma.sql`AND (u.full_name ILIKE ${'%' + search + '%'} OR u.username ILIKE ${'%' + search + '%'} OR u.bio ILIKE ${'%' + search + '%'})`
        : Prisma.empty;
      const featuredClause =
        isFeatured !== undefined ? Prisma.sql`AND u.is_featured_creator = ${isFeatured}` : Prisma.empty;

      const [orderedRows, totalCount] = await Promise.all([
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT u.id
          FROM users u
          LEFT JOIN keyboard_themes kt ON kt.created_by = u.id AND kt.status = 'PUBLISHED'
          WHERE u.deleted_at IS NULL
            AND u.username IS NOT NULL
            AND u.is_creator = true
            ${searchClause}
            ${featuredClause}
          GROUP BY u.id
          ORDER BY COALESCE(SUM(kt.download_count), 0) DESC, u.created_at DESC
          LIMIT ${safeLimit} OFFSET ${skip};
        `,
        prisma.user.count({ where }),
      ]);

      total = totalCount;
      const orderedIds = orderedRows.map((r) => r.id);

      if (orderedIds.length > 0) {
        const fetchedUsers = await prisma.user.findMany({
          where: { id: { in: orderedIds } },
          select: {
            id: true,
            fullName: true,
            username: true,
            bio: true,
            avatarUrl: true,
            bannerUrl: true,
            isCreator: true,
            isFeaturedCreator: true,
            createdAt: true,
            _count: {
              select: {
                followers: true,
                authoredThemes: { where: { status: 'PUBLISHED' } },
              },
            },
          },
        });

        const userMap = new Map(fetchedUsers.map((u) => [u.id, u]));
        users = orderedIds.map((id) => userMap.get(id)).filter(Boolean) as typeof fetchedUsers;
      } else {
        users = [];
      }
    } else {
      const [fetchedUsers, totalCount] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            fullName: true,
            username: true,
            bio: true,
            avatarUrl: true,
            bannerUrl: true,
            isCreator: true,
            isFeaturedCreator: true,
            createdAt: true,
            _count: {
              select: {
                followers: true,
                authoredThemes: { where: { status: 'PUBLISHED' } },
              },
            },
          },
          orderBy,
          skip,
          take: safeLimit,
        }),
        prisma.user.count({ where }),
      ]);
      users = fetchedUsers;
      total = totalCount;
    }

    const userIds = users.map((u) => u.id);

    // Batch query aggregates for all creators on page in parallel (O(1) queries instead of N+1)
    const downloadAggregates = userIds.length > 0
      ? await prisma.keyboardTheme.groupBy({
          by: ['createdBy'],
          where: {
            createdBy: { in: userIds },
            status: 'PUBLISHED',
          },
          _sum: {
            downloadCount: true,
            likeCount: true,
          },
        })
      : [];

    const downloadStatsMap = new Map<string, { downloadsCount: number; likesCount: number }>();
    for (const item of downloadAggregates) {
      if (item.createdBy) {
        downloadStatsMap.set(item.createdBy, {
          downloadsCount: item._sum.downloadCount || 0,
          likesCount: item._sum.likeCount || 0,
        });
      }
    }

    const dataWithStats = users.map((user) => {
      const downloadStats = downloadStatsMap.get(user.id) || { downloadsCount: 0, likesCount: 0 };

      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username!,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        isCreator: user.isCreator,
        isFeaturedCreator: user.isFeaturedCreator,
        stats: {
          themesCount: user._count.authoredThemes,
          downloadsCount: downloadStats.downloadsCount,
          likesCount: downloadStats.likesCount,
          followersCount: user._count.followers,
        },
      };
    });

    return {
      data: dataWithStats,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async isUserFollowing(followerId: string, followingId: string): Promise<boolean> {
    const record = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
      select: { id: true },
    });
    return !!record;
  }

  async toggleFollow(
    followerId: string,
    followingId: string,
  ): Promise<{ isFollowing: boolean; followerCount: number }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existing) {
        await tx.userFollow.delete({
          where: { id: existing.id },
        });
        const followerCount = await tx.userFollow.count({
          where: { followingId },
        });
        return { isFollowing: false, followerCount };
      } else {
        await tx.userFollow.create({
          data: {
            followerId,
            followingId,
          },
        });
        const followerCount = await tx.userFollow.count({
          where: { followingId },
        });
        return { isFollowing: true, followerCount };
      }
    });
  }

  async getUserFollowingList(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const safePage = Math.max(1, Number(page) || 1);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.UserFollowWhereInput = {
      followerId: userId,
      following: { deletedAt: null },
    };

    const [follows, total] = await prisma.$transaction([
      prisma.userFollow.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true,
              fullName: true,
              username: true,
              bio: true,
              avatarUrl: true,
              bannerUrl: true,
              isCreator: true,
              isFeaturedCreator: true,
            },
          },
        },
      }),
      prisma.userFollow.count({ where }),
    ]);

    const followingIds = follows.map((f) => f.following.id);

    // Batch query aggregates for all followed creators in parallel (O(1) queries instead of N+1)
    const [themeAggregates, followerAggregates] = followingIds.length > 0
      ? await Promise.all([
          prisma.keyboardTheme.groupBy({
            by: ['createdBy'],
            where: {
              createdBy: { in: followingIds },
              status: 'PUBLISHED',
            },
            _count: {
              _all: true,
            },
            _sum: {
              downloadCount: true,
              likeCount: true,
            },
          }),
          prisma.userFollow.groupBy({
            by: ['followingId'],
            where: {
              followingId: { in: followingIds },
            },
            _count: {
              _all: true,
            },
          }),
        ])
      : [[], []];

    const themeStatsMap = new Map<string, { themesCount: number; downloadsCount: number; likesCount: number }>();
    for (const item of themeAggregates) {
      if (item.createdBy) {
        themeStatsMap.set(item.createdBy, {
          themesCount: item._count._all || 0,
          downloadsCount: item._sum.downloadCount || 0,
          likesCount: item._sum.likeCount || 0,
        });
      }
    }

    const followerStatsMap = new Map<string, number>();
    for (const item of followerAggregates) {
      followerStatsMap.set(item.followingId, item._count._all || 0);
    }

    const data = follows.map((f) => {
      const themeStats = themeStatsMap.get(f.following.id) || { themesCount: 0, downloadsCount: 0, likesCount: 0 };
      const followersCount = followerStatsMap.get(f.following.id) || 0;

      return {
        id: f.following.id,
        fullName: f.following.fullName,
        username: f.following.username || '',
        bio: f.following.bio,
        avatarUrl: f.following.avatarUrl,
        bannerUrl: f.following.bannerUrl,
        isCreator: f.following.isCreator,
        isFeaturedCreator: f.following.isFeaturedCreator,
        stats: {
          themesCount: themeStats.themesCount,
          downloadsCount: themeStats.downloadsCount,
          likesCount: themeStats.likesCount,
          followersCount,
        },
        followedAt: f.createdAt,
      };
    });

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const creatorRepository = new CreatorRepository();
