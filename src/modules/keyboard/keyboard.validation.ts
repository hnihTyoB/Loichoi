import { z } from 'zod';
import { isThemeDownloadUrl } from '../../common/constants/keyboard.constant';
import { isPublicHttpUrl } from '../../common/helpers/url.helper';

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const previewImageItemSchema = z.object({
  url: z
    .string()
    .url('URL ảnh xem trước không hợp lệ')
    .refine((url) => isPublicHttpUrl(url), {
      message: 'URL ảnh xem trước không an toàn hoặc không hợp lệ',
    }),
  altText: z.string().max(200, 'Alt text tối đa 200 ký tự').optional(),
  position: z.number().int().min(0, 'Position phải là số nguyên không âm'),
});

export const createKeyboardSchema = z
  .object({
    name: z.string().min(3, 'Tên theme phải có tối thiểu 3 ký tự').max(150, 'Tên theme tối đa 150 ký tự').trim(),
    slug: z
      .string()
      .min(2, 'Slug phải có tối thiểu 2 ký tự')
      .max(100, 'Slug tối đa 100 ký tự')
      .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
      .optional(),
    description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional(),
    coverUrl: z
      .string()
      .url('URL ảnh cover không hợp lệ')
      .refine((url) => isPublicHttpUrl(url), {
        message: 'URL ảnh cover không an toàn hoặc không hợp lệ',
      }),
    driveUrl: z
      .string()
      .url('URL tải xuống không hợp lệ')
      .refine((url) => isThemeDownloadUrl(url), {
        message: 'URL tải file phải thuộc Google Drive hoặc Discord và sử dụng HTTPS',
      }),
    platform: z.enum(['IOS', 'ANDROID', 'BOTH'], {
      errorMap: () => ({ message: 'Nền tảng phải là IOS, ANDROID hoặc BOTH' }),
    }),
    status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional().default('DRAFT'),
    accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']).optional().default('FREE'),
    requiredDiscordRoleIds: z.array(z.string().trim().min(1, 'Role ID không được rỗng')).optional().default([]),
    categoryIds: z.array(z.string().uuid('Category ID phải là UUID hợp lệ')),
    colorIds: z.array(z.string().uuid('Color ID phải là UUID hợp lệ')).optional().default([]),
    styleIds: z.array(z.string().uuid('Style ID phải là UUID hợp lệ')).optional().default([]),
    isFeatured: z.boolean().optional().default(false),
    previewImages: z.array(previewImageItemSchema).max(10, 'Tối đa 10 ảnh xem trước').optional().default([]),
  })
  .refine(
    (data) => {
      if (data.status === 'PUBLISHED' && (!data.categoryIds || data.categoryIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Theme ở trạng thái PUBLISHED bắt buộc phải có ít nhất 1 danh mục',
      path: ['categoryIds'],
    },
  );

export const updateKeyboardSchema = z
  .object({
    name: z.string().min(3, 'Tên theme phải có tối thiểu 3 ký tự').max(150, 'Tên theme tối đa 150 ký tự').trim().optional(),
    slug: z
      .string()
      .min(2, 'Slug phải có tối thiểu 2 ký tự')
      .max(100, 'Slug tối đa 100 ký tự')
      .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
      .optional(),
    description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional().nullable(),
    coverUrl: z
      .string()
      .url('URL ảnh cover không hợp lệ')
      .refine((url) => isPublicHttpUrl(url), {
        message: 'URL ảnh cover không an toàn hoặc không hợp lệ',
      })
      .optional(),
    driveUrl: z
      .string()
      .url('URL tải xuống không hợp lệ')
      .refine((url) => isThemeDownloadUrl(url), {
        message: 'URL tải file phải thuộc Google Drive hoặc Discord và sử dụng HTTPS',
      })
      .optional(),
    platform: z.enum(['IOS', 'ANDROID', 'BOTH']).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
    accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']).optional(),
    requiredDiscordRoleIds: z.array(z.string().trim().min(1, 'Role ID không được rỗng')).optional(),
    categoryIds: z.array(z.string().uuid('Category ID phải là UUID hợp lệ')).optional(),
    colorIds: z.array(z.string().uuid('Color ID phải là UUID hợp lệ')).optional(),
    styleIds: z.array(z.string().uuid('Style ID phải là UUID hợp lệ')).optional(),
    isFeatured: z.boolean().optional(),
    previewImages: z.array(previewImageItemSchema).max(10, 'Tối đa 10 ảnh xem trước').optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'PUBLISHED' && data.categoryIds !== undefined && data.categoryIds.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Theme ở trạng thái PUBLISHED không được để trống danh mục',
      path: ['categoryIds'],
    },
  );


export const keyboardIdParamSchema = z.object({
  id: z.string().uuid('ID theme phải là UUID hợp lệ'),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('User ID phải là UUID hợp lệ'),
});

export const keyboardSlugParamSchema = z.object({
  slug: z.string().min(2).max(100).regex(slugRegex, 'Slug không đúng định dạng'),
});

export const keyboardPublicQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  categories: z.string().trim().optional(),
  color: z.string().trim().optional(),
  colors: z.string().trim().optional(),
  style: z.string().trim().optional(),
  styles: z.string().trim().optional(),
  platform: z.enum(['IOS', 'ANDROID', 'BOTH']).optional(),
  accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']).optional(),
  isFeatured: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  creator: z.string().trim().optional(),
  sort: z.enum(['LATEST', 'POPULAR', 'TOP_LIKED', 'TOP_DOWNLOADED', 'NAME_ASC', 'NAME_DESC']).optional().default('LATEST'),
});

export const keyboardManagementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
  categoryId: z.string().uuid().optional(),
  colorId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  platform: z.enum(['IOS', 'ANDROID', 'BOTH']).optional(),
  isFeatured: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sort: z.string().optional().default('createdAt_desc'),
});

export const getThemeImageUploadUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], {
    errorMap: () => ({ message: 'contentType phải là một trong các định dạng: image/jpeg, image/png, image/webp, image/gif, image/avif' }),
  }),
  imageType: z.enum(['COVER', 'PREVIEW']).optional().default('COVER'),
});

export const getThemeBatchImageUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], {
          errorMap: () => ({ message: 'contentType phải là một trong các định dạng: image/jpeg, image/png, image/webp, image/gif, image/avif' }),
        }),
        imageType: z.enum(['COVER', 'PREVIEW']).optional().default('COVER'),
      }),
    )
    .min(1, 'Cần ít nhất 1 file để yêu cầu upload URL')
    .max(15, 'Tối đa 15 file mỗi lần yêu cầu upload URL'),
});

export const bulkDeleteKeyboardSchema = z.object({
  ids: z.array(z.string().uuid('ID theme phải là UUID hợp lệ')).min(1, 'Cần chọn ít nhất 1 theme để xóa').max(100, 'Tối đa 100 theme mỗi lần xóa'),
});

export type BulkDeleteKeyboardDto = z.infer<typeof bulkDeleteKeyboardSchema>;

export const keyboardLikedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type KeyboardLikedQueryDto = z.infer<typeof keyboardLikedQuerySchema>;

