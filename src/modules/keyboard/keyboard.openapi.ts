import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  createKeyboardSchema,
  updateKeyboardSchema,
  keyboardIdParamSchema,
  keyboardSlugParamSchema,
  keyboardPublicQuerySchema,
  keyboardManagementQuerySchema,
  keyboardLikedQuerySchema,
  getThemeImageUploadUrlSchema,
  getThemeBatchImageUploadUrlsSchema,
  bulkDeleteKeyboardSchema,
} from './keyboard.validation';
import { z } from 'zod';

const CreatorSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable().openapi({ example: 'Kuro Themes' }),
  username: z.string().nullable().openapi({ example: 'kurothemes' }),
  avatarUrl: z.string().url().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
});

const ColorSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().openapi({ example: 'Pink' }),
  slug: z.string().openapi({ example: 'pink' }),
  hex: z.string().openapi({ example: '#FFB7C5' }),  
});

const StyleSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().openapi({ example: 'Cyberpunk' }),
  slug: z.string().openapi({ example: 'cyberpunk' }),
  description: z.string().nullable().optional().openapi({ example: 'Futuristic neon-inspired visual style' }),
});


export function registerKeyboardOpenApi(): void {
  openapiRegistry.register('CreateKeyboardRequest', createKeyboardSchema);
  openapiRegistry.register('UpdateKeyboardRequest', updateKeyboardSchema);

  // 1. GET /keyboards (Public list)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards',
    tags: ['Keyboard Themes'],
    summary: 'Danh sách giao diện bàn phím đã phát hành (Public)',
    description: 'Tìm kiếm, lọc theo danh mục / màu sắc (color/colors) / phong cách (style/styles) / nền tảng / tác giả / mức giá và phân trang cho các theme PUBLISHED.',
    request: { query: keyboardPublicQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách theme thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Sakura Dream' }),
                  slug: z.string().openapi({ example: 'sakura-dream' }),
                  coverUrl: z.string().url(),
                  platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                  accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                  downloadCount: z.number().int().openapi({ example: 126000 }),
                  likeCount: z.number().int().openapi({ example: 3400 }),
                  isFeatured: z.boolean().openapi({ example: true }),
                  isLiked: z.boolean().optional().openapi({ example: false }),
                  publishedAt: z.string().datetime().nullable(),
                  author: CreatorSummarySchema.nullable(),
                  categories: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      slug: z.string(),
                    }),
                  ),
                  colors: z.array(ColorSummarySchema),
                  styles: z.array(StyleSummarySchema),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 2. GET /keyboards/me/liked (User's liked themes)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/me/liked',
    tags: ['Keyboard Themes'],
    summary: 'Danh sách giao diện bàn phím người dùng đã thả tim (Yêu cầu đăng nhập & quyền KEYBOARD_LIKE_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: keyboardLikedQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách theme đã thích thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Sakura Dream' }),
                  slug: z.string().openapi({ example: 'sakura-dream' }),
                  coverUrl: z.string().url(),
                  platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                  accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  downloadCount: z.number().int(),
                  likeCount: z.number().int(),
                  isFeatured: z.boolean(),
                  isLiked: z.boolean().openapi({ example: true }),
                  publishedAt: z.string().datetime().nullable(),
                  author: CreatorSummarySchema.nullable(),
                  categories: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      slug: z.string(),
                    }),
                  ),
                  colors: z.array(ColorSummarySchema),
                  styles: z.array(StyleSummarySchema),
                  likedAt: z.string().datetime(),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 3. POST /keyboards/{slug}/like (Toggle like)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/{slug}/like',
    tags: ['Keyboard Themes'],
    summary: 'Thả tim / Bỏ thả tim giao diện bàn phím (Yêu cầu đăng nhập)',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardSlugParamSchema },
    responses: {
      200: {
        description: 'Thực hiện thả tim hoặc bỏ thả tim thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              themeId: z.string().uuid(),
              slug: z.string(),
              liked: z.boolean().openapi({ example: true }),
              likeCount: z.number().int().openapi({ example: 3401 }),
              message: z.string().openapi({ example: 'Đã thêm vào danh sách yêu thích' }),
            }),
          },
        },
      },
    },
  });

  // 4. GET /keyboards/{slug} (Public detail)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/{slug}',
    tags: ['Keyboard Themes'],
    summary: 'Xem chi tiết giao diện bàn phím theo slug (Public)',
    description: 'Lấy thông tin chi tiết của theme PUBLISHED kèm cover, preview images, colors, styles, author profile và lượt like.',
    request: { params: keyboardSlugParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết theme thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Sakura Dream' }),
                slug: z.string().openapi({ example: 'sakura-dream' }),
                description: z.string().nullable(),
                coverUrl: z.string().url(),
                platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                downloadCount: z.number().int().openapi({ example: 126000 }),
                likeCount: z.number().int().openapi({ example: 3400 }),
                isFeatured: z.boolean().openapi({ example: true }),
                isLiked: z.boolean().optional(),
                publishedAt: z.string().datetime().nullable(),
                author: CreatorSummarySchema.nullable(),
                categories: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    slug: z.string(),
                  }),
                ),
                colors: z.array(ColorSummarySchema),
                styles: z.array(StyleSummarySchema),
                previewImages: z.array(
                  z.object({
                    id: z.string().uuid(),
                    url: z.string().url(),
                    altText: z.string().nullable(),
                    position: z.number().int(),
                  }),
                ),
              }),
            }),
          },
        },
      },
      404: {
        description: 'Không tìm thấy theme hoặc chưa phát hành',
      },
    },
  });

  // 5. POST /keyboards/{slug}/download (Authenticated download)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/{slug}/download',
    tags: ['Keyboard Themes'],
    summary: 'Yêu cầu tải theme bàn phím (Yêu cầu đăng nhập, Discord Gated, Redirect 302 tới nguồn tải)',
    description:
      'Xác thực tài khoản người dùng, kiểm tra điều kiện Discord Server Member / Role (nếu theme yêu cầu), ghi nhận lịch sử Download, tăng bộ đếm lượt tải và phản hồi HTTP 302 Found chuyển hướng tới Google Drive hoặc Discord.',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardSlugParamSchema },
    responses: {
      302: {
        description: 'Chuyển hướng thành công tới URL Google Drive hoặc Discord đã được allowlist trong Header Location',
      },
      401: {
        description: 'Chưa đăng nhập hoặc token không hợp lệ',
      },
      403: {
        description: 'Tài khoản chưa thỏa mãn điều kiện tải (DISCORD_NOT_LINKED, DISCORD_GUILD_REQUIRED, hoặc DISCORD_ROLE_REQUIRED)',
      },
      404: {
        description: 'Theme không tồn tại hoặc chưa được phát hành',
      },
      429: {
        description: 'Vượt quá giới hạn tần suất tải file (Rate limit exceeded: 5 req/phút)',
      },
    },
  });

  // 6. GET /keyboards/manage (Management list)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/manage',
    tags: ['Keyboard Themes'],
    summary: 'Danh sách theme cho quản trị viên (Yêu cầu quyền KEYBOARD_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: keyboardManagementQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách quản trị thành công',
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
                  driveUrl: z.string().url(),
                  platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']),
                  accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                  downloadCount: z.number().int(),
                  likeCount: z.number().int(),
                  isFeatured: z.boolean(),
                  publishedAt: z.string().datetime().nullable(),
                  author: CreatorSummarySchema.nullable(),
                  categoryNames: z.array(z.string()),
                  colorNames: z.array(z.string()),
                  styleNames: z.array(z.string()),
                  colors: z.array(ColorSummarySchema),
                  styles: z.array(StyleSummarySchema),
                  createdAt: z.string().datetime(),
                  updatedAt: z.string().datetime(),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 7. GET /keyboards/manage/{id} (Management detail)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/manage/{id}',
    tags: ['Keyboard Themes'],
    summary: 'Xem chi tiết theme cho quản trị viên (Yêu cầu quyền KEYBOARD_READ)',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardIdParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết quản trị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                description: z.string().nullable(),
                coverUrl: z.string().url(),
                driveUrl: z.string().url(),
                platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']),
                accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                downloadCount: z.number().int(),
                likeCount: z.number().int(),
                isFeatured: z.boolean(),
                publishedAt: z.string().datetime().nullable(),
                author: CreatorSummarySchema.nullable(),
                categories: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    slug: z.string(),
                    isActive: z.boolean(),
                  }),
                ),
                colors: z.array(ColorSummarySchema),
                styles: z.array(StyleSummarySchema),
                previewImages: z.array(
                  z.object({
                    id: z.string().uuid(),
                    url: z.string().url(),
                    altText: z.string().nullable(),
                    position: z.number().int(),
                    createdAt: z.string().datetime(),
                  }),
                ),
                createdBy: z.string().uuid().nullable(),
                updatedBy: z.string().uuid().nullable(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 8. POST /keyboards (Create theme)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards',
    tags: ['Keyboard Themes'],
    summary: 'Tạo mới theme bàn phím (Yêu cầu quyền KEYBOARD_CREATE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createKeyboardSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo theme thành công',
      },
    },
  });

  // 9. PATCH /keyboards/{id} (Update theme)
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/keyboards/{id}',
    tags: ['Keyboard Themes'],
    summary: 'Cập nhật theme bàn phím (Yêu cầu quyền KEYBOARD_UPDATE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: keyboardIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateKeyboardSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật theme thành công',
      },
    },
  });

  // 10. DELETE /keyboards/{id} (Delete / Archive theme)
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/keyboards/{id}',
    tags: ['Keyboard Themes'],
    summary: 'Xóa hoặc Lưu trữ (Archive) theme (Yêu cầu quyền KEYBOARD_DELETE)',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardIdParamSchema },
    responses: {
      200: {
        description: 'Xóa hoặc chuyển sang trạng thái HIDDEN thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              archived: z.boolean().optional(),
            }),
          },
        },
      },
    },
  });

  // 11. POST /keyboards/manage/users/{userId}/reset-quota (Admin reset user quota)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/manage/users/{userId}/reset-quota',
    tags: ['Keyboard Themes'],
    summary: 'Reset hạn mức số lượt tải cho người dùng (Yêu cầu quyền KEYBOARD_UPDATE)',
    description: 'Cập nhật mốc reset tải về của người dùng và ghi nhận Audit Log.',
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({
        userId: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
      }),
    },
    responses: {
      200: {
        description: 'Reset hạn mức thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              userId: z.string().uuid(),
              resetAt: z.string().datetime(),
              message: z.string().openapi({ example: 'Đã reset hạn mức tải về của người dùng thành công' }),
            }),
          },
        },
      },
    },
  });

  // 12. POST /keyboards/upload-url (Get presigned upload URL for single image)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/upload-url',
    tags: ['Keyboard Themes'],
    summary: 'Lấy presigned URL tải ảnh theme trực tiếp lên R2',
    description: 'Tạo URL ký trước để client upload file ảnh trực tiếp lên Cloudflare R2.',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: getThemeImageUploadUrlSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Lấy presigned URL thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                uploadUrl: z.string().url(),
                publicUrl: z.string().url(),
                key: z.string(),
                expiresIn: z.number().int(),
              }),
            }),
          },
        },
      },
    },
  });

  // 13. POST /keyboards/batch-upload-urls (Get presigned upload URLs for multiple images)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/batch-upload-urls',
    tags: ['Keyboard Themes'],
    summary: 'Lấy danh sách presigned URLs để tải nhiều ảnh theme cùng lúc lên R2',
    description: 'Tạo danh sách URLs ký trước song song cho nhiều file ảnh theme.',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: getThemeBatchImageUploadUrlsSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Lấy batch presigned URLs thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                items: z.array(
                  z.object({
                    uploadUrl: z.string().url(),
                    publicUrl: z.string().url(),
                    key: z.string(),
                    expiresIn: z.number().int(),
                  }),
                ),
              }),
            }),
          },
        },
      },
    },
  });

  // 14. POST /keyboards/manage/bulk-delete (Bulk delete themes)
  openapiRegistry.register('BulkDeleteKeyboardRequest', bulkDeleteKeyboardSchema);
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/manage/bulk-delete',
    tags: ['Keyboard Themes'],
    summary: 'Xóa hàng loạt giao diện bàn phím (Yêu cầu quyền KEYBOARD_DELETE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: bulkDeleteKeyboardSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Xóa hàng loạt thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                succeeded: z.array(z.string().uuid()),
                failed: z.array(
                  z.object({
                    id: z.string(),
                    reason: z.string(),
                  }),
                ),
                totalRequested: z.number().int(),
                totalDeleted: z.number().int(),
              }),
            }),
          },
        },
      },
    },
  });
}

