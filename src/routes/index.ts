import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import rbacRoute from '../modules/rbac/rbac.route';
import notificationRoute from '../modules/notification/notification.route';
import maintenanceRoute from '../modules/maintenance/maintenance.route';
import integrationRoute from '../modules/integration/integration.route';
import systemConfigRoute from '../modules/system-config/system-config.route';
import cronRoute from '../modules/cron/cron.route';
import categoryRoute from '../modules/category/category.route';
import colorRoute from '../modules/color/color.route';
import styleRoute from '../modules/style/style.route';
import keyboardRoute from '../modules/keyboard/keyboard.route';
import creatorRoute from '../modules/creator/creator.route';
import studioRoute from '../modules/studio/studio.route';
import discordImportRoute from '../modules/discord-import/discord-import.route';
import healthRoute from './health.route';
import { maintenanceGuard } from '../middlewares/maintenance.middleware';

const router = Router();

router.use('/health', healthRoute);

router.use('/maintenance', maintenanceRoute);

router.use('/system', systemConfigRoute);

router.use(maintenanceGuard());

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/rbac', rbacRoute);
router.use('/notifications', notificationRoute);
router.use('/integrations', integrationRoute);
router.use('/integration', integrationRoute);
router.use('/cron', cronRoute);
router.use('/categories', categoryRoute);
router.use('/colors', colorRoute);
router.use('/styles', styleRoute);
router.use('/keyboards', keyboardRoute);
router.use('/creators', creatorRoute);
router.use('/studio', studioRoute);
router.use('/imports', discordImportRoute);

export default router;



