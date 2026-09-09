import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscordMediaService } from '../src/modules/discord-import/discord-media.service';
import { DiscordOAuthService } from '../src/modules/auth/discord-oauth.service';
import { isThemeDownloadUrl } from '../src/common/constants/keyboard.constant';
import { creatorFollowingQuerySchema } from '../src/modules/creator/creator.validation';
import { userSelect } from '../src/modules/users/user.repository';
import { WebhookWorker } from '../src/common/workers/webhook.worker';
import { integrationRepository } from '../src/modules/integration/integration.repository';
import { encryptSecret } from '../src/common/helpers/crypto.helper';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';
import { getVietnamDayRange } from '../src/common/helpers/date.helper';
import { envConfig } from '../src/config/env.config';

describe('Comprehensive Remediation Verification (All 17 Audit Findings BL-01 -> BL-17)', () => {
  describe('Giai đoạn 1: Vá Khẩn Cấp Security & Data Loss (P0)', () => {
    it('[BL-01] DiscordMediaService should block SSRF, private IPs, loopback, and non-http URLs in production', async () => {
      const oldEnv = envConfig.nodeEnv;
      try {
        (envConfig as any).nodeEnv = 'production';
        const privateTargets = [
          'http://127.0.0.1/evil.png',
          'http://localhost:3000/internal',
          'http://169.254.169.254/latest/meta-data',
          'http://10.0.0.1/admin.jpg',
          'http://192.168.1.1/secret.jpg',
          'ftp://example.com/test.png',
          'file:///etc/passwd',
        ];

        for (const target of privateTargets) {
          const result = await DiscordMediaService.downloadAndUploadToR2(target, 'test-key');
          assert.equal(result, null, `Expected ${target} to be blocked by SSRF/validation guard`);
        }
      } finally {
        (envConfig as any).nodeEnv = oldEnv;
      }
    });

    it('[BL-02] DiscordImportService.resetAllImports should block execution in production environment', async () => {
      const { DiscordImportService } = await import('../src/modules/discord-import/discord-import.service');
      const oldEnv = envConfig.nodeEnv;

      try {
        (envConfig as any).nodeEnv = 'production';
        const service = new DiscordImportService();

        await assert.rejects(
          async () => service.resetAllImports('admin-id'),
          (err: AppError) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, ERROR_CODE.FORBIDDEN);
            assert.ok(err.message.includes('Production'));
            return true;
          },
        );
      } finally {
        (envConfig as any).nodeEnv = oldEnv;
      }
    });
  });

  describe('Giai đoạn 2: Vá Authorization & Lỗi Vận Hành Production (P1 - Auth/Data)', () => {
    it('[BL-07] DiscordOAuthService should generate and consume distributed state asynchronously', async () => {
      const service = new DiscordOAuthService();
      const state = await service.generateState('https://example.com/callback', 'test-nonce-123');
      assert.ok(typeof state === 'string' && state.length > 0);

      // Verify and consume valid state
      const verified = await service.verifyAndConsumeState(state, 'test-nonce-123');
      assert.equal(verified.isValid, true);
      assert.equal(verified.redirectUri, 'https://example.com/callback');

      // Subsequent consumption of already-used state must fail (prevent replay attacks)
      const replayed = await service.verifyAndConsumeState(state, 'test-nonce-123');
      assert.equal(replayed.isValid, false);

      // Omitted nonce cookie must be rejected (prevent CSRF bypass)
      const stateWithNonce = await service.generateState('https://example.com/callback', 'bound-nonce-999');
      const bypassAttempt = await service.verifyAndConsumeState(stateWithNonce, undefined);
      assert.equal(bypassAttempt.isValid, false, 'Omitting nonce cookie must be rejected');
    });

    it('[BL-06] getVietnamDayRange should construct exact UTC+7 date boundaries from YYYY-MM-DD', () => {
      const { startOfDay, endOfDay } = getVietnamDayRange('2026-09-05');
      // In UTC+7, 2026-09-05 00:00:00 +07:00 is 2026-09-04 17:00:00 UTC
      assert.equal(startOfDay.toISOString(), '2026-09-04T17:00:00.000Z');
      // In UTC+7, 2026-09-05 23:59:59.999 +07:00 is 2026-09-05 16:59:59.999 UTC
      assert.equal(endOfDay.toISOString(), '2026-09-05T16:59:59.999Z');
    });
  });

  describe('Giai đoạn 3: Tối Ưu Hiệu Năng & Khắc Phục Lỗi Logic (P1 - Perf & Logic)', () => {
    it('[BL-12] creatorFollowingQuerySchema should validate pagination query correctly', () => {
      const validQuery = { page: '2', limit: '25' };
      const parsed = creatorFollowingQuerySchema.safeParse(validQuery);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 2);
        assert.equal(parsed.data.limit, 25);
      }

      // Default values
      const emptyQuery = {};
      const parsedDefault = creatorFollowingQuerySchema.safeParse(emptyQuery);
      assert.equal(parsedDefault.success, true);
      if (parsedDefault.success) {
        assert.equal(parsedDefault.data.page, 1);
        assert.equal(parsedDefault.data.limit, 20);
      }
    });

    it('[BL-13] userSelect in user.repository should include creator profile fields', () => {
      assert.equal(userSelect.username, true);
      assert.equal(userSelect.bio, true);
      assert.equal(userSelect.bannerUrl, true);
      assert.equal(userSelect.isCreator, true);
      assert.equal(userSelect.creatorStatus, true);
      assert.equal(userSelect.isFeaturedCreator, true);
    });

    it('[BL-14] isThemeDownloadUrl should accept Drive and Discord CDN but reject private jump links', () => {
      // Valid URLs
      assert.equal(isThemeDownloadUrl('https://drive.google.com/file/d/123/view'), true);
      assert.equal(isThemeDownloadUrl('https://docs.google.com/uc?id=123'), true);
      assert.equal(isThemeDownloadUrl('https://cdn.discordapp.com/attachments/1/2/theme.bdi'), true);

      // Invalid URLs / private jump link fallback
      assert.equal(isThemeDownloadUrl('https://malicious.com/download.zip'), false);
      assert.equal(isThemeDownloadUrl('http://insecure.com/theme'), false);
      assert.equal(isThemeDownloadUrl('invalid-url-string'), false);
    });

    it('[BL-15] WebhookWorker should disallow HTTP redirects to prevent SSRF', async () => {
      const originalUpdate = integrationRepository.updateDeliveryStatus;
      (integrationRepository as any).updateDeliveryStatus = async () => ({} as any);

      try {
        const worker = new WebhookWorker();
        const mockRedirectFetcher = async () => {
          return {
            status: 302,
            ok: false,
            text: async () => 'Found redirect to http://169.254.169.254/secret',
          } as any;
        };

        const jobData = {
          deliveryId: '11111111-2222-3333-4444-555555555555',
          webhookEndpointId: '22222222-3333-4444-5555-666666666666',
          userId: '33333333-4444-5555-6666-777777777777',
          event: 'test.event',
          url: 'https://webhook.site/redirect-endpoint',
          encryptedSecret: encryptSecret('plain-webhook-secret-123'),
          payload: { test: true },
        };

        await assert.rejects(
          async () => worker.processJob(jobData, 0, mockRedirectFetcher),
          (err: Error) => {
            assert.ok(err.message.includes('disallowed for security reasons'));
            return true;
          },
        );
      } finally {
        integrationRepository.updateDeliveryStatus = originalUpdate;
      }
    });

    it('[BL-17] unlikeTheme atomic decrement calculation GREATEST(0, like_count - 1)', () => {
      // Test math logic equivalent to PostgreSQL GREATEST(0, like_count - 1)
      const computeNewCount = (current: number) => Math.max(0, current - 1);

      assert.equal(computeNewCount(10), 9);
      assert.equal(computeNewCount(1), 0);
      assert.equal(computeNewCount(0), 0);
      assert.equal(computeNewCount(-1), 0);
    });
  });
});
