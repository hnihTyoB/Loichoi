import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { RoleQueryDto, AuditLogQueryDto } from './rbac.dto';
import { getVietnamDayRange } from '../../common/helpers/date.helper';

export class RbacRepository {
  async findAllRoles(query: RoleQueryDto) {
    const { search, sortBy = 'createdAt', order = 'asc', page = 1, limit = 20 } = query;

    const where: Prisma.RoleWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.role.count({ where }),
    ]);

    return {
      data: data.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.users,
        permissions: role.permissions.map((rp) => rp.permission),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findRoleById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => rp.permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async findRoleByName(name: string) {
    return prisma.role.findUnique({
      where: { name },
    });
  }

  async createRole(data: { name: string; description?: string; permissionIds?: string[] }) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: data.name,
          description: data.description,
          isSystem: false,
        },
      });

      if (data.permissionIds && data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return role;
    });
  }

  async updateRole(id: string, data: { name?: string; description?: string }) {
    return prisma.role.update({
      where: { id },
      data,
    });
  }

  async deleteRole(id: string) {
    return prisma.role.delete({
      where: { id },
    });
  }

  async findAllPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findPermissionsByIds(ids: string[]) {
    return prisma.permission.findMany({
      where: { id: { in: ids } },
    });
  }

  async findPermissionByName(name: string) {
    return prisma.permission.findUnique({
      where: { name },
    });
  }

  async syncRolePermissions(roleId: string, permissionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  async addPermissionToRole(roleId: string, permissionId: string) {
    return prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId,
      },
    });
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId,
      },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, roleId: true },
    });
  }

  async assignUserRole(userId: string, roleId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: (data.details as any) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async findAllAuditLogs(query: AuditLogQueryDto) {
    const { actorId, action, targetType, targetId, startDate, endDate, search, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const safePage = Math.max(1, Number(page) || 1);

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      try {
        if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          const { startOfDay } = getVietnamDayRange(startDate);
          createdAtFilter.gte = startOfDay;
        } else {
          const parsed = new Date(startDate);
          if (!isNaN(parsed.getTime())) {
            createdAtFilter.gte = parsed;
          }
        }
      } catch {
        // Bỏ qua giá trị ngày không hợp lệ
      }
    }
    if (endDate) {
      try {
        if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const { endOfDay } = getVietnamDayRange(endDate);
          createdAtFilter.lte = endOfDay;
        } else {
          const end = new Date(endDate);
          if (!isNaN(end.getTime())) {
            if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0) {
              end.setHours(23, 59, 59, 999);
            }
            createdAtFilter.lte = end;
          }
        }
      } catch {
        // Bỏ qua giá trị ngày không hợp lệ
      }
    }

    let matchingActorIds: string[] = [];
    if (actorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: actorId, mode: 'insensitive' } },
            { username: { contains: actorId, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      matchingActorIds = users.map((u) => u.id);
    }

    let searchUserIds: string[] = [];
    if (search) {
      const matchedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      searchUserIds = matchedUsers.map((u) => u.id);
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(actorId
        ? matchingActorIds.length > 0
          ? { actorId: { in: matchingActorIds } }
          : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)
          ? { actorId }
          : { actorId: '__NOT_FOUND__' }
        : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(startDate || endDate ? { createdAt: createdAtFilter } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { targetType: { contains: search, mode: 'insensitive' } },
              { targetId: { contains: search, mode: 'insensitive' } },
              { ipAddress: { contains: search, mode: 'insensitive' } },
              ...(searchUserIds.length > 0
                ? [
                    { actorId: { in: searchUserIds } },
                    { targetId: { in: searchUserIds } },
                  ]
                : []),
            ],
          }
        : {}),
    };

    const skip = (safePage - 1) * safeLimit;

    const [rawLogs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const userIds = new Set<string>();
    for (const log of rawLogs) {
      if (log.actorId) userIds.add(log.actorId);
      if (log.targetType === 'USER' && log.targetId) userIds.add(log.targetId);
    }

    const users =
      userIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, email: true, fullName: true, username: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = rawLogs.map((log) => {
      const actor = log.actorId ? userMap.get(log.actorId) || null : null;
      const targetUser = log.targetType === 'USER' && log.targetId ? userMap.get(log.targetId) || null : null;
      const details = (log.details as Record<string, unknown> | null) || {};

      const actorEmail = actor?.email || (typeof details.actorEmail === 'string' ? details.actorEmail : null);
      const targetEmail =
        targetUser?.email ||
        (typeof details.userEmail === 'string'
          ? details.userEmail
          : typeof details.targetEmail === 'string'
          ? details.targetEmail
          : typeof details.email === 'string'
          ? details.email
          : null);

      let targetLabel: string | null = null;
      if (log.targetType === 'USER') {
        targetLabel = targetEmail || targetUser?.fullName || targetUser?.username || log.targetId;
      } else if (typeof details.roleName === 'string') {
        targetLabel = details.roleName;
      } else if (typeof details.themeName === 'string') {
        targetLabel = details.themeName;
      } else if (typeof details.categoryName === 'string') {
        targetLabel = details.categoryName;
      } else if (typeof details.key === 'string') {
        targetLabel = details.key;
      } else if (typeof details.templateCode === 'string') {
        targetLabel = details.templateCode;
      }

      return {
        ...log,
        actor,
        actorEmail,
        targetUser,
        targetEmail,
        targetLabel,
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const rbacRepository = new RbacRepository();

