import { Router } from 'express';
import { keyboardController } from './keyboard.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { requireFeatureFlag } from '../../middlewares/feature-flag.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import { FEATURE_FLAGS } from '../../common/constants/system-config.constant';
import {
  createKeyboardSchema,
  updateKeyboardSchema,
  keyboardIdParamSchema,
  userIdParamSchema,
  keyboardSlugParamSchema,
  keyboardPublicQuerySchema,
  keyboardManagementQuerySchema,
  keyboardLikedQuerySchema,
  getThemeImageUploadUrlSchema,
  getThemeBatchImageUploadUrlsSchema,
  bulkDeleteKeyboardSchema,
} from './keyboard.validation';

const router = Router();

const downloadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Bạn đã thực hiện quá nhiều yêu cầu tải file. Vui lòng thử lại sau 1 phút.',
  keyGenerator: (req) => `download_${req.user?.id || req.ip}`,
});

router.post(
  '/upload-url',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_CREATE),
  validate(getThemeImageUploadUrlSchema),
  keyboardController.getImageUploadUrl,
);

router.post(
  '/batch-upload-urls',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_CREATE),
  validate(getThemeBatchImageUploadUrlsSchema),
  keyboardController.getBatchImageUploadUrls,
);

router.get(
  '/manage',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_READ),
  validate(keyboardManagementQuerySchema, 'query'),
  keyboardController.findManagementList,
);

router.post(
  '/manage/bulk-delete',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_DELETE),
  validate(bulkDeleteKeyboardSchema),
  keyboardController.bulkDelete,
);

router.post(
  '/manage/users/:userId/reset-quota',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_UPDATE),
  validate(userIdParamSchema, 'params'),
  keyboardController.resetUserQuota,
);

router.get(
  '/manage/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_READ),
  validate(keyboardIdParamSchema, 'params'),
  keyboardController.findManagementById,
);

router.get(
  '/me/liked',
  authMiddleware,
  requireFeatureFlag(FEATURE_FLAGS.KEYBOARD_LIKES_ENABLED),
  requirePermission(PERMISSIONS.KEYBOARD_LIKE_READ),
  validate(keyboardLikedQuerySchema, 'query'),
  keyboardController.findUserLikedThemes,
);

router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_CREATE),
  validate(createKeyboardSchema),
  keyboardController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_UPDATE),
  validate(keyboardIdParamSchema, 'params'),
  validate(updateKeyboardSchema),
  keyboardController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_DELETE),
  validate(keyboardIdParamSchema, 'params'),
  keyboardController.delete,
);

router.get(
  '/',
  optionalAuthMiddleware,
  validate(keyboardPublicQuerySchema, 'query'),
  keyboardController.findPublicList,
);

router.post(
  '/:slug/like',
  authMiddleware,
  requireFeatureFlag(FEATURE_FLAGS.KEYBOARD_LIKES_ENABLED),
  validate(keyboardSlugParamSchema, 'params'),
  keyboardController.toggleLike,
);

router.post(
  '/:slug/download',
  authMiddleware,
  downloadRateLimiter,
  validate(keyboardSlugParamSchema, 'params'),
  keyboardController.download,
);

router.get(
  '/:slug',
  optionalAuthMiddleware,
  validate(keyboardSlugParamSchema, 'params'),
  keyboardController.findPublicBySlug,
);

export default router;
