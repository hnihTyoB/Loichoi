import crypto from 'crypto';
import { prisma } from '../../database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthRepository {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: { role: true, socialAccounts: true },
    });
  }

  findAnyByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
      },
      include: { role: true, socialAccounts: true },
    });
  }

  findById(id: string) {
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true, socialAccounts: true },
    });
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string) {
    return prisma.refreshToken.create({
      data: {
        userId,
        token: hashToken(token),
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token: hashToken(token) },
    });
  }

  async deleteRefreshToken(token: string) {
    return prisma.refreshToken.deleteMany({
      where: { token: hashToken(token) },
    });
  }

  async findBySocial(provider: string, providerUserId: string) {
    const socialAccount = await prisma.userSocial.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        user: {
          include: { role: true, socialAccounts: true },
        },
      },
    });
    return socialAccount ? socialAccount.user : null;
  }

  async createSocialAccount(data: { userId: string; provider: string; providerUserId: string }) {
    return prisma.userSocial.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        providerUserId: data.providerUserId,
      },
    });
  }

  async createSocialUser(data: {
    fullName?: string;
    email?: string;
    avatarUrl?: string;
    roleId: string;
    provider: string;
    providerUserId: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        roleId: data.roleId,
        isActive: true, // Social users are active immediately
        socialAccounts: {
          create: {
            provider: data.provider,
            providerUserId: data.providerUserId,
          },
        },
      },
      include: { role: true, socialAccounts: true },
    });
  }

  async createVerificationToken(userId: string, token: string, expiresAt: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { userId },
      });
      return tx.verificationToken.create({
        data: {
          userId,
          token: hashToken(token), // BUG-06 fix: store SHA-256 hash, not raw token
          expiresAt,
        },
      });
    });
  }

  async findVerificationToken(token: string) {
    return prisma.verificationToken.findUnique({
      where: { token: hashToken(token) }, // BUG-06 fix: lookup by hash
      include: { user: true },
    });
  }

  async activateUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }

  async deleteVerificationToken(tokenId: string) {
    return prisma.verificationToken.delete({
      where: { id: tokenId },
    });
  }

  async findRoleByName(name: string) {
    return prisma.role.findUnique({
      where: { name },
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName?: string;
    roleId: string;
    isActive: boolean;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        fullName: data.fullName,
        roleId: data.roleId,
        isActive: data.isActive,
      },
    });
  }

  async findByPhone(phoneNumber: string) {
    return prisma.user.findFirst({
      where: { phoneNumber, deletedAt: null },
    });
  }

  async updateProfile(userId: string, data: { fullName?: string; avatarUrl?: string; phoneNumber?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }

  async softDelete(userId: string, adminId: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          deletedBy: adminId,
          isActive: false,
        },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId },
      });
      return tx.passwordResetToken.create({
        data: {
          userId,
          token: hashToken(token), // BUG-06 fix: store SHA-256 hash, not raw token
          expiresAt,
        },
      });
    });
  }

  async findPasswordResetToken(token: string) {
    return prisma.passwordResetToken.findUnique({
      where: { token: hashToken(token) }, // BUG-06 fix: lookup by hash
      include: { user: true },
    });
  }

  async deletePasswordResetToken(tokenId: string) {
    return prisma.passwordResetToken.delete({
      where: { id: tokenId },
    });
  }

  async findUserDevice(userId: string, deviceHash: string) {
    return prisma.userDevice.findUnique({
      where: {
        userId_deviceHash: {
          userId,
          deviceHash,
        },
      },
    });
  }

  async upsertUserDevice(data: { userId: string; deviceHash: string; deviceName: string; ipAddress?: string }) {
    return prisma.userDevice.upsert({
      where: {
        userId_deviceHash: {
          userId: data.userId,
          deviceHash: data.deviceHash,
        },
      },
      update: {
        ipAddress: data.ipAddress,
        lastLoginAt: new Date(),
      },
      create: {
        userId: data.userId,
        deviceHash: data.deviceHash,
        deviceName: data.deviceName,
        ipAddress: data.ipAddress,
      },
    });
  }

  async updateUserDeviceLastLogin(userId: string, deviceHash: string, ipAddress?: string) {
    return prisma.userDevice.update({
      where: {
        userId_deviceHash: {
          userId,
          deviceHash,
        },
      },
      data: {
        ipAddress,
        lastLoginAt: new Date(),
      },
    });
  }

  async findDevicesByUserId(userId: string) {
    return prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastLoginAt: 'desc' },
    });
  }

  async findDeviceById(userId: string, deviceId: string) {
    return prisma.userDevice.findFirst({
      where: { id: deviceId, userId },
    });
  }

  async deleteDeviceById(userId: string, deviceId: string) {
    return prisma.userDevice.deleteMany({
      where: { id: deviceId, userId },
    });
  }

  async findSessionsByUserId(userId: string) {
    return prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSessionById(userId: string, sessionId: string) {
    return prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
  }

  async deleteSessionById(userId: string, sessionId: string) {
    return prisma.refreshToken.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  async rotateRefreshToken(userId: string, oldToken: string, newToken: string, expiresAt: Date, userAgent?: string, ipAddress?: string) {
    const oldTokenHash = hashToken(oldToken);
    const newTokenHash = hashToken(newToken);

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.refreshToken.deleteMany({
        where: { token: oldTokenHash },
      });

      if (deleted.count === 0) {
        // Automatic Token Family Invalidation (RFC 6819):
        // If an already rotated/revoked refresh token is re-sent, invalidate all active tokens for this user
        await tx.refreshToken.deleteMany({ where: { userId } });
        throw new AppError('Refresh token không hợp lệ hoặc đã được sử dụng. Toàn bộ phiên đăng nhập đã được thu hồi vì lý do bảo mật.', 401, ERROR_CODE.TOKEN_INVALID);
      }

      return tx.refreshToken.create({
        data: {
          userId,
          token: newTokenHash,
          expiresAt,
          userAgent,
          ipAddress,
        },
      });
    });
  }

  async updatePasswordAndRevokeTokens(userId: string, passwordHash: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);
  }

  async registerUserWithVerification(userData: {
    email: string;
    passwordHash: string;
    fullName?: string;
    roleId: string;
    isActive: boolean;
  }, token: string, expiresAt: Date) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: userData.email,
          password: userData.passwordHash,
          fullName: userData.fullName,
          roleId: userData.roleId,
          isActive: userData.isActive,
        },
      });
      await tx.verificationToken.create({
        data: {
          userId: user.id,
          token: hashToken(token),
          expiresAt,
        },
      });
      return user;
    });
  }

  async activateUserAndDeleteToken(userId: string, tokenId: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      }),
      prisma.verificationToken.delete({
        where: { id: tokenId },
      }),
    ]);
  }

  async resetPasswordAndRevokeTokens(userId: string, passwordHash: string, tokenId: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: tokenId },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);
  }

  async deleteOtherSessions(userId: string, currentToken: string) {
    // BUG-01 fix: DB stores SHA-256 hash of token; must hash currentToken before comparing
    const hashedCurrentToken = hashToken(currentToken);
    return prisma.refreshToken.deleteMany({
      where: {
        userId,
        NOT: {
          token: hashedCurrentToken,
        },
      },
    });
  }
}

