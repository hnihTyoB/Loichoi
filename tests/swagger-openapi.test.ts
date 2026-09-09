import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { swaggerSpec, swaggerOptions } from '../src/config/swagger.config';

describe('Auto Swagger OpenAPI Generation via zod-to-openapi', () => {
  it('should generate valid OpenAPI 3.0.0 root document', () => {
    assert.equal(swaggerSpec.openapi, '3.0.0');
    assert.equal(swaggerSpec.info.title, 'KeyboardHub API');
    assert.equal(swaggerSpec.info.version, '1.0.0');
    assert.ok(Array.isArray(swaggerSpec.servers));
    assert.equal(swaggerSpec.servers[0].url, '/api/v1');
  });

  it('should register standard security schemes (BearerAuth and ApiKeyAuth)', () => {
    assert.ok(swaggerSpec.components?.securitySchemes?.BearerAuth);
    assert.equal(swaggerSpec.components.securitySchemes.BearerAuth.type, 'http');
    assert.equal(swaggerSpec.components.securitySchemes.BearerAuth.scheme, 'bearer');

    assert.ok(swaggerSpec.components?.securitySchemes?.ApiKeyAuth);
    assert.equal(swaggerSpec.components.securitySchemes.ApiKeyAuth.type, 'apiKey');
    assert.equal(swaggerSpec.components.securitySchemes.ApiKeyAuth.name, 'x-api-key');
  });

  it('should register shared response component schemas', () => {
    const schemas = swaggerSpec.components?.schemas;
    assert.ok(schemas);
    assert.ok(schemas.SuccessResponse);
    assert.ok(schemas.PaginationMeta);
    assert.ok(schemas.ErrorResponse);
    assert.ok(schemas.ValidationErrorResponse);
  });

  it('should auto-register domain request schemas from Zod validation definitions', () => {
    const schemas = swaggerSpec.components?.schemas;
    assert.ok(schemas);
    assert.ok(schemas.LoginRequest);
    assert.ok(schemas.RegisterRequest);
    assert.ok(schemas.CreateUserRequest);
    assert.ok(schemas.UpdateUserRequest);
    assert.ok(schemas.CreateRoleRequest);
    assert.ok(schemas.CreateApiKeyRequest);
    assert.ok(schemas.CreateWebhookRequest);
    assert.ok(schemas.CreateSystemConfigRequest);
    assert.ok(schemas.TriggerCronJobRequest);
    assert.ok(schemas.BulkDeleteKeyboardRequest);
  });

  it('should contain all module routes across Auth, Users, RBAC, Notifications, Maintenance, Integrations, System Config, Cron, and Health', () => {
    const paths = swaggerSpec.paths;
    assert.ok(paths);

    // Auth paths
    assert.ok(paths['/auth/register']);
    assert.ok(paths['/auth/login']);
    assert.ok(paths['/auth/me']);
    assert.ok(paths['/auth/refresh']);
    assert.ok(paths['/auth/logout']);
    assert.ok(paths['/auth/sessions']);
    assert.ok(paths['/auth/avatar/upload-url']);
    assert.ok(paths['/auth/devices']);
    assert.ok(paths['/auth/devices/{id}']);
    assert.ok(paths['/auth/discord']);
    assert.ok(paths['/auth/discord/callback']);

    // User paths
    assert.ok(paths['/users']);
    assert.ok(paths['/users/{id}']);
    assert.ok(paths['/users/{id}/sessions']);
    assert.ok(paths['/users/{id}/devices']);

    // RBAC paths
    assert.ok(paths['/rbac/roles']);
    assert.ok(paths['/rbac/roles/{id}']);
    assert.ok(paths['/rbac/permissions']);
    assert.ok(paths['/rbac/audit-logs']);

    // Notification paths
    assert.ok(paths['/notifications']);
    assert.ok(paths['/notifications/templates']);
    assert.ok(paths['/notifications/emails']);
    assert.ok(paths['/notifications/emails/{id}/retry']);
    assert.ok(paths['/notifications/templates/{code}/test-send']);
    assert.ok(paths['/notifications/stream']);

    // Maintenance paths
    assert.ok(paths['/maintenance/public']);
    assert.ok(paths['/maintenance/status']);
    assert.ok(paths['/maintenance/config']);
    assert.ok(paths['/maintenance/enable']);
    assert.ok(paths['/maintenance/disable']);

    // Integration paths
    assert.ok(paths['/integration/api-keys']);
    assert.ok(paths['/integration/webhooks']);
    assert.ok(paths['/integration/jobs/trigger']);

    // System config paths
    assert.ok(paths['/system/public']);
    assert.ok(paths['/system/configs']);
    assert.ok(paths['/system/features/{key}/toggle']);

    // Cron paths
    assert.ok(paths['/cron/jobs']);
    assert.ok(paths['/cron/jobs/{jobName}/trigger']);

    // Health paths
    assert.ok(paths['/health']);
    assert.ok(paths['/health/readiness']);
    assert.ok(paths['/health/liveness']);

    // Platform domain modules paths
    assert.ok(paths['/categories']);
    assert.ok(paths['/categories/manage']);
    assert.ok(paths['/colors']);
    assert.ok(paths['/colors/manage']);
    assert.ok(paths['/styles']);
    assert.ok(paths['/styles/manage']);
    assert.ok(paths['/keyboards']);
    assert.ok(paths['/keyboards/manage']);
    assert.ok(paths['/keyboards/manage/bulk-delete']);
    assert.ok(paths['/creators']);
    assert.ok(paths['/creators/manage/applications']);
    assert.ok(paths['/studio/stats']);
    assert.ok(paths['/studio/themes']);
    assert.ok(paths['/studio/upload-url']);
    assert.ok(paths['/imports']);
    assert.ok(paths['/imports/bulk-approve']);
  });

  it('should export valid swaggerOptions configuration for Swagger UI', () => {
    assert.equal(swaggerOptions.customSiteTitle, 'KeyboardHub API Documentation');
    assert.ok(typeof swaggerOptions.customCss === 'string');
    assert.ok(swaggerOptions.customCss.includes('.swagger-ui'));
  });
});

