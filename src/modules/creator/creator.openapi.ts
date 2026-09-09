import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  usernameParamSchema,
  creatorQuerySchema,
  creatorApplicationQuerySchema,
  rejectCreatorApplicationSchema,
} from './creator.validation';
import { keyboardPublicQuerySchema, userIdParamSchema } from '../keyboard/keyboard.validation';
import { z } from 'zod';

const CreatorStatsSchema = z.object({
  themesCount: z.number().int().openapi({ example: 18 }),
  downloadsCount: z.number().int().openapi({ example: 126000 }),
  followersCount: z.number().int().openapi({ example: 12000 }),
  likesCount: z.number().int().openapi({ example: 3400 }),
});

const CreatorPublicSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable().openapi({ example: 'Kuro Themes' }),
  username: z.string().openapi({ example: 'kurothemes' }),
  bio: z.string().nullable().openapi({ example: 'Specialized in pastel and anime keyboard themes for iOS and Android.' }),
  avatarUrl: z.string().url().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
  bannerUrl: z.string().url().nullable().openapi({ example: 'https://example.com/banner.jpg' }),
  isCreator: z.boolean().openapi({ example: true }),
  isFeaturedCreator: z.boolean().openapi({ example: true }),
  socialLinks: z.record(z.string()).nullable().openapi({ example: { twitter: 'https://twitter.com/kurothemes', discord: 'https://discord.gg/kuro' } }),
  stats: CreatorStatsSchema,
  isFollowing: z.boolean().optional().openapi({ example: false }),
  joinedAt: z.string().datetime(),
});

export function registerCreatorOpenApi(): void {
  // 1. GET /creators (Public list)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/creators',
    tags: ['Creators'],
    summary: 'Danh sách và bảng xếp hạng Người sáng tạo (Creators)',
    description: 'Tìm kiếm, lọc theo nổi bật (featured) và sắp xếp theo số lượng follower, download hoặc số lượng theme.',
    request: { query: creatorQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách creators thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  fullName: z.string().nullable(),
                  username: z.string(),
                  bio: z.string().nullable(),
                  avatarUrl: z.string().url().nullable(),
                  bannerUrl: z.string().url().nullable(),
                  isCreator: z.boolean(),
                  isFeaturedCreator: z.boolean(),
                  stats: CreatorStatsSchema,
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 2. GET /creators/me/following (User's followed creators)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/creators/me/following',
    tags: ['Creators'],
    summary: 'Danh sách Creators mà người dùng đang theo dõi',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy danh sách following thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  fullName: z.string().nullable(),
                  username: z.string(),
                  bio: z.string().nullable(),
                  avatarUrl: z.string().url().nullable(),
                  bannerUrl: z.string().url().nullable(),
                  isCreator: z.boolean(),
                  isFeaturedCreator: z.boolean(),
                  stats: CreatorStatsSchema,
                  followedAt: z.string().datetime(),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 3. GET /creators/{username} (Public detail)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/creators/{username}',
    tags: ['Creators'],
    summary: 'Xem hồ sơ công khai của Creator kèm số liệu thống kê',
    description: 'Bao gồm @username, bio, mạng xã hội, tổng số theme, tổng lượt tải, số follower và trạng thái follow.',
    request: { params: usernameParamSchema },
    responses: {
      200: {
        description: 'Lấy thông tin profile creator thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: CreatorPublicSchema,
            }),
          },
        },
      },
      404: {
        description: 'Creator không tồn tại',
      },
    },
  });

  // 4. GET /creators/{username}/themes (Creator's themes)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/creators/{username}/themes',
    tags: ['Creators'],
    summary: 'Danh sách theme đã phát hành của Creator',
    request: {
      params: usernameParamSchema,
      query: keyboardPublicQuerySchema,
    },
    responses: {
      200: {
        description: 'Lấy danh sách theme của creator thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  slug: z.string(),
                  coverUrl: z.string().url(),
                  platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                  accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  downloadCount: z.number().int(),
                  likeCount: z.number().int(),
                  isFeatured: z.boolean(),
                  publishedAt: z.string().datetime().nullable(),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 5. POST /creators/{username}/follow (Follow / Unfollow toggle)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/creators/{username}/follow',
    tags: ['Creators'],
    summary: 'Theo dõi hoặc Bỏ theo dõi Creator (Yêu cầu đăng nhập)',
    security: [{ BearerAuth: [] }],
    request: { params: usernameParamSchema },
    responses: {
      200: {
        description: 'Thực hiện follow / unfollow thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              creatorId: z.string().uuid(),
              username: z.string(),
              isFollowing: z.boolean().openapi({ example: true }),
              followerCount: z.number().int().openapi({ example: 12001 }),
              message: z.string().openapi({ example: 'Đã theo dõi @kurothemes' }),
            }),
          },
        },
      },
      400: {
        description: 'Không thể tự theo dõi chính mình',
      },
      404: {
        description: 'Creator không tồn tại',
      },
    },
  });

  // 6. GET /creators/manage/applications (Admin)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/creators/manage/applications',
    tags: ['Creators'],
    summary: 'Danh sách đơn đăng ký trở thành Creator (Yêu cầu quyền CREATOR_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: { query: creatorApplicationQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách đơn đăng ký thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  userId: z.string().uuid(),
                  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
                  portfolioUrl: z.string().url().nullable(),
                  socialLinks: z.record(z.string()).nullable(),
                  bio: z.string().nullable(),
                  adminNotes: z.string().nullable(),
                  reviewedAt: z.string().datetime().nullable(),
                  createdAt: z.string().datetime(),
                  user: z.object({
                    id: z.string().uuid(),
                    email: z.string().email(),
                    fullName: z.string().nullable(),
                    username: z.string().nullable(),
                    avatarUrl: z.string().url().nullable(),
                  }),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 7. POST /creators/manage/applications/:userId/approve (Admin)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/creators/manage/applications/{userId}/approve',
    tags: ['Creators'],
    summary: 'Duyệt đơn đăng ký Creator và cấp quyền (Yêu cầu quyền CREATOR_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: { params: userIdParamSchema },
    responses: {
      200: {
        description: 'Duyệt đơn đăng ký thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã duyệt đơn đăng ký Creator thành công' }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy đơn đăng ký' },
    },
  });

  // 8. POST /creators/manage/applications/:userId/reject (Admin)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/creators/manage/applications/{userId}/reject',
    tags: ['Creators'],
    summary: 'Từ chối đơn đăng ký Creator (Yêu cầu quyền CREATOR_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
      body: {
        content: {
          'application/json': { schema: rejectCreatorApplicationSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Từ chối đơn đăng ký thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã từ chối đơn đăng ký Creator' }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy đơn đăng ký' },
    },
  });

  // 9. POST /creators/manage/creators/:userId/revoke (Admin)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/creators/manage/creators/{userId}/revoke',
    tags: ['Creators'],
    summary: 'Thu hồi tư cách Creator của người dùng (Yêu cầu quyền CREATOR_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: { params: userIdParamSchema },
    responses: {
      200: {
        description: 'Thu hồi tư cách Creator thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã thu hồi tư cách Creator của người dùng' }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });
}
