import { SwaggerUiOptions } from 'swagger-ui-express';
import { buildOpenApiSpec } from './openapi/openapi.registry';
import { registerAuthOpenApi } from '../modules/auth/auth.openapi';
import { registerUserOpenApi } from '../modules/users/user.openapi';
import { registerRbacOpenApi } from '../modules/rbac/rbac.openapi';
import { registerNotificationOpenApi } from '../modules/notification/notification.openapi';
import { registerMaintenanceOpenApi } from '../modules/maintenance/maintenance.openapi';
import { registerIntegrationOpenApi } from '../modules/integration/integration.openapi';
import { registerSystemConfigOpenApi } from '../modules/system-config/system-config.openapi';
import { registerCronOpenApi } from '../modules/cron/cron.openapi';
import { registerCategoryOpenApi } from '../modules/category/category.openapi';
import { registerColorOpenApi } from '../modules/color/color.openapi';
import { registerStyleOpenApi } from '../modules/style/style.openapi';
import { registerKeyboardOpenApi } from '../modules/keyboard/keyboard.openapi';
import { registerCreatorOpenApi } from '../modules/creator/creator.openapi';
import { registerStudioOpenApi } from '../modules/studio/studio.openapi';
import { registerDiscordImportOpenApi } from '../modules/discord-import/discord-import.openapi';
import { registerHealthOpenApi } from '../routes/health.openapi';

// Tự động khởi tạo và đăng ký 100% routes & schemas từ Zod validation schemas
registerAuthOpenApi();
registerUserOpenApi();
registerRbacOpenApi();
registerNotificationOpenApi();
registerMaintenanceOpenApi();
registerIntegrationOpenApi();
registerSystemConfigOpenApi();
registerCronOpenApi();
registerCategoryOpenApi();
registerColorOpenApi();
registerStyleOpenApi();
registerKeyboardOpenApi();
registerCreatorOpenApi();
registerStudioOpenApi();
registerDiscordImportOpenApi();
registerHealthOpenApi();


export const swaggerOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper .link img { display: none; }
    .swagger-ui .topbar-wrapper .link::after { content: 'KeyboardHub API'; color: white; font-size: 1.2rem; font-weight: bold; }
  `,
  customSiteTitle: 'KeyboardHub API Documentation',
};

export const swaggerSpec: Record<string, any> = buildOpenApiSpec();