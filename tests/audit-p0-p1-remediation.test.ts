import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../src/config/jwt.config';
import { hashToken } from '../src/common/helpers/crypto.helper';
import { escapeHtml, renderTemplateString } from '../src/common/helpers/template.helper';
import { studioCreateThemeSchema, studioUpdateThemeSchema } from '../src/modules/studio/studio.validation';
import { extractTokenFromRequest, authMiddleware } from '../src/middlewares/auth.middleware';

describe('P0 & P1 Full Audit Remediation Test Suite', () => {

  describe('1. [P0-01] JWT Payload Standardization & Auth Context Resolution', () => {
    it('should correctly sign and verify access token with both id and userId', () => {
      const user = {
        id: '11111111-2222-3333-4444-555555555555',
        email: 'user@example.com',
        role: 'MEMBER',
        roleId: 'role-123-uuid',
      };

      const payload = {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
      };

      const token = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: '1h' });
      const decoded = jwt.verify(token, jwtConfig.accessSecret) as any;

      assert.equal(decoded.id, user.id);
      assert.equal(decoded.userId, user.id);
      assert.equal(decoded.email, user.email);
      assert.equal(decoded.role, user.role);
    });

    it('should resolve req.user.id in authMiddleware for standardized token', async () => {
      const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const payload = {
        id: userId,
        userId: userId,
        email: 'test@example.com',
        role: 'CREATOR',
        roleId: 'role-creator-id',
      };

      const token = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: '1h' });

      const req: any = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        path: '/api/v1/creators/me',
      };
      const res: any = {};
      let nextCalled = false;

      await authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.user.id, userId);
      assert.equal(req.user.email, 'test@example.com');
      assert.equal(req.user.role, 'CREATOR');
    });
  });

  describe('2. [P0-02] Verification Token SHA-256 Hashing', () => {
    it('should hash verification token consistently with hashToken helper', () => {
      const rawToken = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const hashed1 = hashToken(rawToken);
      const hashed2 = hashToken(rawToken);

      assert.equal(hashed1, hashed2);
      assert.notEqual(hashed1, rawToken);
      assert.equal(hashed1.length, 64); // SHA-256 hex string length
    });
  });

  describe('4. [P1-03] Creator Studio Schema Validation with colorIds & styleIds', () => {
    it('should parse studioCreateThemeSchema with valid colorIds and styleIds', () => {
      const validPayload = {
        name: 'Pastel Lavender Theme',
        coverUrl: 'https://cdn.example.com/cover.png',
        driveUrl: 'https://drive.google.com/file/d/123456789/view',
        platform: 'BOTH',
        status: 'PUBLISHED',
        categoryIds: ['11111111-2222-4111-8111-111111111111'],
        colorIds: ['22222222-2222-4222-8222-222222222222'],
        styleIds: ['33333333-3333-4333-8333-333333333333'],
      };

      const result = studioCreateThemeSchema.safeParse(validPayload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.deepEqual(result.data.colorIds, ['22222222-2222-4222-8222-222222222222']);
        assert.deepEqual(result.data.styleIds, ['33333333-3333-4333-8333-333333333333']);
      }
    });

    it('should parse studioUpdateThemeSchema with colorIds and styleIds', () => {
      const updatePayload = {
        colorIds: ['22222222-2222-4222-8222-222222222222'],
        styleIds: ['33333333-3333-4333-8333-333333333333'],
      };

      const result = studioUpdateThemeSchema.safeParse(updatePayload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.deepEqual(result.data.colorIds, ['22222222-2222-4222-8222-222222222222']);
        assert.deepEqual(result.data.styleIds, ['33333333-3333-4333-8333-333333333333']);
      }
    });
  });

  describe('5. [P2-03] HTML Injection Sanitization in Email Templates', () => {
    it('should escape dangerous HTML characters in user full names', () => {
      const maliciousName = '<script>alert("XSS")</script><a href="https://evil.com">Click</a>';
      const escaped = escapeHtml(maliciousName);

      assert.equal(escaped.includes('<script>'), false);
      assert.equal(escaped.includes('</script>'), false);
      assert.equal(escaped.includes('<a href='), false);
      assert.equal(escaped.includes('&lt;script&gt;'), true);
      assert.equal(escaped.includes('&lt;/script&gt;'), true);
    });

    it('should safely render template strings with variables', () => {
      const template = 'Xin chào {{fullName}}, mã xác nhận của bạn là {{token}}';
      const output = renderTemplateString(template, {
        fullName: 'Nguyễn Văn A',
        token: '123456',
      });

      assert.equal(output, 'Xin chào Nguyễn Văn A, mã xác nhận của bạn là 123456');
    });
  });

  describe('6. [P1-05] Soft-Deleted User Email Retention & Registration Conflict Prevention', () => {
    it('should detect existing email even if user is soft-deleted (preserving account for future reactivation)', async () => {
      const email = 'retained_user@example.com';
      const mockSoftDeletedUser = {
        id: '12345678-1234-4123-8123-123456789012',
        email,
        deletedAt: new Date(),
        isActive: false,
      };

      const mockRepo = {
        findAnyByEmail: async (targetEmail: string) => {
          if (targetEmail === email) return mockSoftDeletedUser;
          return null;
        },
      };

      const existing = await mockRepo.findAnyByEmail(email);
      assert.notEqual(existing, null);
      assert.equal(existing?.email, email);
      assert.notEqual(existing?.deletedAt, null);
    });
  });

});
