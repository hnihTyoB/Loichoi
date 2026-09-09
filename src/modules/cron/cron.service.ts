import { CronRepository, cronRepository } from './cron.repository';
import { systemConfigService } from '../system-config/system-config.service';
import { R2Service } from '../../common/services/r2.service';
import { notificationDispatcher } from '../../common/services/notification-dispatcher.service';
import { cronQueue } from '../../common/queues/cron.queue';
import {
  CRON_JOB_NAMES,
  CronJobName,
  DEFAULT_CRON_SCHEDULES,
  DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS,
} from '../../common/constants/cron.constant';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE, SYSTEM_TARGET_ID } from '../../common/constants/audit-log.constant';
import { EMAIL_TEMPLATE_KEY, NOTIFICATION_CHANNEL } from '../../common/constants/notification.constant';
import { formatVietnamDate, getVietnamDayRange } from '../../common/helpers/date.helper';
import { extractR2Key } from '../../common/helpers/r2.helper';
import { CronJobExecutionResultDto, CronJobItemDto } from './cron.dto';

export class CronService {
  constructor(
    private readonly repository: CronRepository = cronRepository,
    private readonly r2Service: R2Service = new R2Service(),
  ) {}

  /**
   * Danh sách toàn bộ các tác vụ định kỳ đã đăng ký trong hệ thống
   */
  async listJobs(search?: string): Promise<CronJobItemDto[]> {
    const jobNames = Object.keys(DEFAULT_CRON_SCHEDULES);
    const [latestRuns, statuses] = await Promise.all([
      this.repository.getLatestRunsForJobs(jobNames),
      this.repository.getJobStatuses(),
    ]);

    const jobs: CronJobItemDto[] = Object.entries(DEFAULT_CRON_SCHEDULES).map(([name, config]) => {
      const history = latestRuns.get(name);
      const isEnabled = statuses[name] !== false; // Mặc định bật nếu chưa cấu hình tắt
      return {
        name: name as CronJobName,
        cron: config.cron,
        description: config.description,
        isEnabled,
        lastRun: history?.lastRun ? history.lastRun.toISOString() : undefined,
        lastStatus: history?.status || 'READY',
      };
    });

    if (search) {
      const lower = search.toLowerCase();
      return jobs.filter(
        (j) => j.name.toLowerCase().includes(lower) || j.description.toLowerCase().includes(lower),
      );
    }

    return jobs;
  }

  /**
   * Bật hoặc tắt kích hoạt tự động theo lịch của một Cron Job
   */
  async toggleJob(
    jobName: CronJobName,
    enabled: boolean,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<CronJobItemDto> {
    const config = DEFAULT_CRON_SCHEDULES[jobName];
    if (!config) {
      throw new Error(`Tác vụ '${jobName}' không tồn tại trong hệ thống`);
    }

    // 1. Cập nhật trạng thái vào cơ sở dữ liệu
    await this.repository.setJobStatus(jobName, enabled);

    // 2. Đồng bộ lịch trình BullMQ Scheduler
    if (enabled) {
      await cronQueue.enableJobScheduler(jobName);
    } else {
      await cronQueue.disableJobScheduler(jobName);
    }

    // 3. Ghi vết Audit Log
    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: AUDIT_ACTION.TOGGLE_FEATURE_FLAG,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: jobName,
      details: { isEnabled: enabled, jobName },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    const latestRuns = await this.repository.getLatestRunsForJobs([jobName]);
    const history = latestRuns.get(jobName);

    return {
      name: jobName,
      cron: config.cron,
      description: config.description,
      isEnabled: enabled,
      lastRun: history?.lastRun ? history.lastRun.toISOString() : undefined,
      lastStatus: history?.status || 'READY',
    };
  }

  /**
   * 1. Dọn dẹp các bản ghi Audit Logs cũ hơn số ngày quy định (mặc định 7 ngày hoặc theo SystemConfig)
   */
  async executeAuditLogCleanup(retentionDays?: number): Promise<{
    deletedCount: number;
    retentionDays: number;
    cutoffDate: string;
  }> {
    let effectiveRetentionDays = retentionDays;
    if (typeof effectiveRetentionDays !== 'number' || effectiveRetentionDays <= 0) {
      const configVal = await systemConfigService
        .get<number>('audit_log.retention_days', DEFAULT_AUDIT_LOG_RETENTION_DAYS)
        .catch(() => DEFAULT_AUDIT_LOG_RETENTION_DAYS);
      effectiveRetentionDays = Number(configVal) || DEFAULT_AUDIT_LOG_RETENTION_DAYS;
    }

    const cutoffDate = new Date(Date.now() - effectiveRetentionDays * 24 * 60 * 60 * 1000);
    const deletedCount = await this.repository.deleteAuditLogsOlderThan(cutoffDate);

    // Ghi audit log hệ thống về việc dọn dẹp
    await this.repository.createAuditLog({
      action: AUDIT_ACTION.CLEANUP_AUDIT_LOGS,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
      details: { deletedCount, retentionDays: effectiveRetentionDays, cutoffDate: cutoffDate.toISOString() },
    });

    return {
      deletedCount,
      retentionDays: effectiveRetentionDays,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * 2. Quét và dọn dẹp các file tải lên không xác nhận / rác trên Cloudflare R2 / S3
   */
  async executeUploadsCleanup(maxAgeHours = DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS): Promise<{
    scannedCount: number;
    deletedCount: number;
    deletedKeys: string[];
  }> {
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    // Lấy toàn bộ danh sách file trong thư mục avatars/ và themes/ trên R2
    const [avatarObjects, themeObjects] = await Promise.all([
      this.r2Service.listObjects('avatars/'),
      this.r2Service.listObjects('themes/'),
    ]);

    const allObjects = [...avatarObjects, ...themeObjects];
    if (allObjects.length === 0) {
      return { scannedCount: 0, deletedCount: 0, deletedKeys: [] };
    }

    // Lấy toàn bộ các avatarUrl và theme images đang được liên kết trong cơ sở dữ liệu
    const [activeAvatarUrls, activeThemeUrls] = await Promise.all([
      this.repository.getAllUserAvatarUrls(),
      this.repository.getAllThemeImageUrls(),
    ]);

    const activeKeySet = new Set<string>();

    for (const url of activeAvatarUrls) {
      const key = extractR2Key(url, 'avatars');
      if (key) {
        activeKeySet.add(key);
      }
    }

    for (const url of activeThemeUrls) {
      const key = extractR2Key(url, 'themes');
      if (key) {
        activeKeySet.add(key);
      }
    }

    const deletedKeys: string[] = [];

    for (const obj of allObjects) {
      // Nếu file chưa từng được liên kết với bất kỳ User hay Theme nào và đã tồn tại quá maxAgeHours
      const isOrphaned = !activeKeySet.has(obj.key);
      const isOldEnough = obj.lastModified ? now - obj.lastModified.getTime() > maxAgeMs : false;

      if (isOrphaned && isOldEnough) {
        await this.r2Service.deleteFile(obj.key).catch((err) => {
          console.warn(`[CronService] Failed to delete orphaned file ${obj.key}:`, err.message);
        });
        deletedKeys.push(obj.key);
      }
    }

    if (deletedKeys.length > 0) {
      await this.repository.createAuditLog({
        action: AUDIT_ACTION.CLEANUP_UNCONFIRMED_UPLOADS,
        targetType: AUDIT_TARGET_TYPE.CRON_JOB,
        targetId: CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS,
        details: { scannedCount: allObjects.length, deletedCount: deletedKeys.length, maxAgeHours },
      });
    }

    return {
      scannedCount: allObjects.length,
      deletedCount: deletedKeys.length,
      deletedKeys,
    };
  }


  /**
   * 3. Dọn dẹp định kỳ các Token xác thực và phiên đã hết hạn
   */
  async executeExpiredTokensCleanup(): Promise<{
    refreshTokensCount: number;
    verificationTokensCount: number;
    passwordResetTokensCount: number;
    totalDeleted: number;
  }> {
    const now = new Date();
    const result = await this.repository.deleteExpiredTokens(now);
    const totalDeleted =
      result.refreshTokensCount + result.verificationTokensCount + result.passwordResetTokensCount;

    if (totalDeleted > 0) {
      await this.repository.createAuditLog({
        action: AUDIT_ACTION.CLEANUP_EXPIRED_TOKENS,
        targetType: AUDIT_TARGET_TYPE.CRON_JOB,
        targetId: CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS,
        details: { ...result, totalDeleted },
      });
    }

    return {
      ...result,
      totalDeleted,
    };
  }

  /**
   * 4. Tổng hợp hoạt động định kỳ (Hàng ngày / Hàng tuần) và gửi email báo cáo tới Quản trị viên
   */
  async executeSummaryDigest(options: { period: 'DAILY' | 'WEEKLY' }): Promise<{
    period: 'DAILY' | 'WEEKLY';
    startDate: string;
    endDate: string;
    stats: any;
    recipientCount: number;
  }> {
    const durationDays = options.period === 'WEEKLY' ? 7 : 1;
    const prevDate = new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000);
    const startDateStr = formatVietnamDate(prevDate);
    const endDateStr = formatVietnamDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const { startOfDay: startDate } = getVietnamDayRange(startDateStr);
    const { endOfDay: endDate } = getVietnamDayRange(endDateStr);

    const stats = await this.repository.getActivityStats(startDate, endDate);
    const admins = await this.repository.findAdminUsers();

    const periodText = options.period === 'WEEKLY' ? 'Hàng tuần' : 'Hàng ngày';

    for (const admin of admins) {
      if (admin.email) {
        await notificationDispatcher.send({
          userId: admin.id,
          channels: [NOTIFICATION_CHANNEL.EMAIL],
          email: {
            toEmail: admin.email,
            templateKey: EMAIL_TEMPLATE_KEY.ACTIVITY_SUMMARY_DIGEST,
            templateData: {
              period: periodText,
              startDate: startDateStr,
              endDate: endDateStr,
              ...stats,
            },
          },
        }).catch((err: any) => {
          console.warn(`[CronService] Failed to send digest email to ${admin.email}:`, err.message);
        });
      }
    }


    await this.repository.createAuditLog({
      action: AUDIT_ACTION.SEND_SUMMARY_DIGEST,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: options.period === 'WEEKLY' ? CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST : CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST,
      details: { period: options.period, stats, recipientCount: admins.length },
    });

    return {
      period: options.period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats,
      recipientCount: admins.length,
    };
  }

  /**
   * Kích hoạt chạy ngay một Cron Job bất kỳ (Manual trigger từ Admin)
   */
  async triggerJob(
    jobName: CronJobName,
    params: Record<string, unknown> = {},
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<CronJobExecutionResultDto> {
    const startTime = Date.now();

    let executionData: Record<string, unknown> | undefined;

    switch (jobName) {
      case CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS: {
        const days = typeof params['retentionDays'] === 'number' ? params['retentionDays'] : undefined;
        executionData = await this.executeAuditLogCleanup(days);
        break;
      }
      case CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS: {
        const hours = typeof params['maxAgeHours'] === 'number' ? params['maxAgeHours'] : DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS;
        executionData = await this.executeUploadsCleanup(hours);
        break;
      }
      case CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS: {
        executionData = await this.executeExpiredTokensCleanup();
        break;
      }
      case CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST: {
        executionData = await this.executeSummaryDigest({ period: 'DAILY' });
        break;
      }
      case CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST: {
        executionData = await this.executeSummaryDigest({ period: 'WEEKLY' });
        break;
      }
      default:
        throw new Error(`Job name '${jobName}' không được hỗ trợ`);
    }

    const durationMs = Date.now() - startTime;

    // Ghi Audit Log hành động trigger của Admin
    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: AUDIT_ACTION.TRIGGER_CRON_JOB,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: jobName,
      details: { params, durationMs, result: executionData },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    return {
      jobName,
      success: true,
      durationMs,
      data: executionData,
    };
  }
}

export const cronService = new CronService();
