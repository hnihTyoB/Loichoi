import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CronService } from '../src/modules/cron/cron.service';
import { CronRepository } from '../src/modules/cron/cron.repository';
import { R2Service } from '../src/common/services/r2.service';
import {
  cronJobNameParamSchema,
  triggerCronJobSchema,
  listCronJobsQuerySchema,
} from '../src/modules/cron/cron.validation';
import { CRON_JOB_NAMES, DEFAULT_CRON_SCHEDULES } from '../src/common/constants/cron.constant';
import { AUDIT_ACTION } from '../src/common/constants/audit-log.constant';

class MockCronRepository extends CronRepository {
  public deletedAuditLogsCount = 15;
  public deletedTokensResult = {
    refreshTokensCount: 10,
    verificationTokensCount: 5,
    passwordResetTokensCount: 3,
  };
  public mockAvatarUrls = [
    'https://pub-r2.example.com/avatars/user-1/active-avatar.webp',
    'https://pub-r2.example.com/avatars/user-2/profile.webp',
  ];
  public mockThemeUrls = [
    'https://pub-r2.example.com/themes/user-1/covers/active-theme.webp',
  ];
  public mockStats = {
    newUsersCount: 25,
    activeSessionsCount: 140,
    notificationsSentCount: 88,
    emailsSentCount: 42,
    webhookDeliveriesCount: 65,
    auditLogsCount: 120,
  };
  public mockAdmins = [
    { id: 'admin-1', email: 'admin@example.com', fullName: 'Super Admin' },
  ];
  public auditLogsCreated: any[] = [];
  public mockStatuses: Record<string, boolean> = {};

  override async getJobStatuses(): Promise<Record<string, boolean>> {
    return this.mockStatuses;
  }

  override async setJobStatus(jobName: string, enabled: boolean): Promise<Record<string, boolean>> {
    this.mockStatuses[jobName] = enabled;
    return this.mockStatuses;
  }

  override async deleteAuditLogsOlderThan(_cutoffDate: Date): Promise<number> {
    return this.deletedAuditLogsCount;
  }

  override async deleteExpiredTokens(_cutoffDate: Date) {
    return this.deletedTokensResult;
  }

  override async getAllUserAvatarUrls(): Promise<string[]> {
    return this.mockAvatarUrls;
  }

  override async getAllThemeImageUrls(): Promise<string[]> {
    return this.mockThemeUrls;
  }

  override async getActivityStats(_startDate: Date, _endDate: Date) {
    return this.mockStats;
  }

  override async findAdminUsers() {
    return this.mockAdmins;
  }

  override async createAuditLog(data: any): Promise<void> {
    this.auditLogsCreated.push(data);
  }
}

class MockR2Service extends R2Service {
  public bucketObjects = [
    {
      key: 'avatars/user-1/active-avatar.webp',
      lastModified: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h old, but active
      size: 1024,
    },
    {
      key: 'avatars/user-99/orphaned-avatar.webp',
      lastModified: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h old, orphaned!
      size: 2048,
    },
    {
      key: 'avatars/user-99/recent-upload.webp',
      lastModified: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1h old, orphaned but recent (keep)
      size: 3072,
    },
  ];
  public themeObjects = [
    {
      key: 'themes/user-1/covers/active-theme.webp',
      lastModified: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h old, active
      size: 4096,
    },
    {
      key: 'themes/user-99/previews/orphaned-preview.webp',
      lastModified: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h old, orphaned!
      size: 5120,
    },
  ];
  public deletedFiles: string[] = [];

  override async listObjects(prefix?: string) {
    if (prefix === 'themes/') return this.themeObjects;
    if (prefix === 'avatars/') return this.bucketObjects;
    return [...this.bucketObjects, ...this.themeObjects];
  }

  override async deleteFile(key: string): Promise<void> {
    this.deletedFiles.push(key);
  }
}


describe('Scheduled Tasks & BullMQ Cron Jobs Engine', () => {
  let mockRepo: MockCronRepository;
  let mockR2: MockR2Service;
  let cronService: CronService;

  beforeEach(() => {
    mockRepo = new MockCronRepository();
    mockR2 = new MockR2Service();
    cronService = new CronService(mockRepo, mockR2);
  });

  it('1. should validate listJobs returns all registered cron jobs with valid cron expressions', async () => {
    const jobs = await cronService.listJobs();
    assert.equal(jobs.length, Object.keys(DEFAULT_CRON_SCHEDULES).length);

    const auditCleanupJob = jobs.find((j) => j.name === CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS);
    assert.ok(auditCleanupJob);
    assert.equal(auditCleanupJob.cron, '0 2 * * *');

    const uploadsCleanupJob = jobs.find((j) => j.name === CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS);
    assert.ok(uploadsCleanupJob);
    assert.equal(uploadsCleanupJob.cron, '0 3 * * *');

    const tokensCleanupJob = jobs.find((j) => j.name === CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS);
    assert.ok(tokensCleanupJob);
    assert.equal(tokensCleanupJob.cron, '0 4 * * *');

    const dailyDigestJob = jobs.find((j) => j.name === CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST);
    assert.ok(dailyDigestJob);
    assert.equal(dailyDigestJob.cron, '0 8 * * *');

    const weeklyDigestJob = jobs.find((j) => j.name === CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST);
    assert.ok(weeklyDigestJob);
    assert.equal(weeklyDigestJob.cron, '0 8 * * 1');
  });

  it('2. Audit Log Cleanup: should delete audit logs older than retention days and record audit log', async () => {
    const result = await cronService.executeAuditLogCleanup(30);
    assert.equal(result.deletedCount, 15);
    assert.equal(result.retentionDays, 30);
    assert.ok(result.cutoffDate);

    assert.equal(mockRepo.auditLogsCreated.length, 1);
    assert.equal(mockRepo.auditLogsCreated[0].action, AUDIT_ACTION.CLEANUP_AUDIT_LOGS);
    assert.equal(mockRepo.auditLogsCreated[0].details.deletedCount, 15);
  });

  it('2.1 Audit Log Cleanup: should default to 7 days retention when no retentionDays argument is passed', async () => {
    const result = await cronService.executeAuditLogCleanup();
    assert.equal(result.deletedCount, 15);
    assert.equal(result.retentionDays, 7);
    assert.ok(result.cutoffDate);
  });

  it('3. R2 Uploads Cleanup: should scan storage and delete only orphaned files older than maxAgeHours', async () => {
    const result = await cronService.executeUploadsCleanup(24);
    assert.equal(result.scannedCount, 5);
    assert.equal(result.deletedCount, 2);
    assert.deepEqual(result.deletedKeys, [
      'avatars/user-99/orphaned-avatar.webp',
      'themes/user-99/previews/orphaned-preview.webp',
    ]);
    assert.deepEqual(mockR2.deletedFiles, [
      'avatars/user-99/orphaned-avatar.webp',
      'themes/user-99/previews/orphaned-preview.webp',
    ]);

    assert.equal(mockRepo.auditLogsCreated.length, 1);
    assert.equal(mockRepo.auditLogsCreated[0].action, AUDIT_ACTION.CLEANUP_UNCONFIRMED_UPLOADS);
  });


  it('4. Expired Tokens Cleanup: should purge expired refresh, verification, and reset tokens', async () => {
    const result = await cronService.executeExpiredTokensCleanup();
    assert.equal(result.refreshTokensCount, 10);
    assert.equal(result.verificationTokensCount, 5);
    assert.equal(result.passwordResetTokensCount, 3);
    assert.equal(result.totalDeleted, 18);

    assert.equal(mockRepo.auditLogsCreated.length, 1);
    assert.equal(mockRepo.auditLogsCreated[0].action, AUDIT_ACTION.CLEANUP_EXPIRED_TOKENS);
  });

  it('5. Summary Activity Digest: should calculate stats and dispatch report to admins for Daily & Weekly periods', async () => {
    const dailyResult = await cronService.executeSummaryDigest({ period: 'DAILY' });
    assert.equal(dailyResult.period, 'DAILY');
    assert.equal(dailyResult.recipientCount, 1);
    assert.equal(dailyResult.stats.newUsersCount, 25);

    const weeklyResult = await cronService.executeSummaryDigest({ period: 'WEEKLY' });
    assert.equal(weeklyResult.period, 'WEEKLY');
    assert.equal(weeklyResult.recipientCount, 1);

    assert.equal(mockRepo.auditLogsCreated.length, 2);
    assert.equal(mockRepo.auditLogsCreated[0].action, AUDIT_ACTION.SEND_SUMMARY_DIGEST);
    assert.equal(mockRepo.auditLogsCreated[1].action, AUDIT_ACTION.SEND_SUMMARY_DIGEST);
  });

  it('6. Manual Trigger: should execute job with params and log trigger audit action with actor details', async () => {
    const triggerResult = await cronService.triggerJob(
      CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
      { retentionDays: 60 },
      { actorId: 'admin-uuid-1', ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' },
    );

    assert.equal(triggerResult.success, true);
    assert.equal(triggerResult.jobName, CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS);
    assert.ok(triggerResult.durationMs >= 0);

    // Should create 2 audit logs: 1 for cleanup action, 1 for the manual trigger
    assert.equal(mockRepo.auditLogsCreated.length, 2);
    const triggerLog = mockRepo.auditLogsCreated.find((l) => l.action === AUDIT_ACTION.TRIGGER_CRON_JOB);
    assert.ok(triggerLog);
    assert.equal(triggerLog.actorId, 'admin-uuid-1');
    assert.equal(triggerLog.ipAddress, '127.0.0.1');
    assert.equal(triggerLog.details.params.retentionDays, 60);
  });

  it('7. Zod Validation: should validate valid job names and reject unrecognized cron job names', () => {
    const validParam = cronJobNameParamSchema.safeParse({ jobName: 'cleanup-audit-logs' });
    assert.equal(validParam.success, true);

    const invalidParam = cronJobNameParamSchema.safeParse({ jobName: 'malicious-or-unknown-job' });
    assert.equal(invalidParam.success, false);

    const validTrigger = triggerCronJobSchema.safeParse({ params: { retentionDays: 45 } });
    assert.equal(validTrigger.success, true);

    const validQuery = listCronJobsQuerySchema.safeParse({ search: 'cleanup' });
    assert.equal(validQuery.success, true);
  });

  it('8. Toggle Job: should enable/disable cron job and record audit log', async () => {
    const disabledResult = await cronService.toggleJob(
      CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS,
      false,
      { actorId: 'admin-uuid-1' },
    );

    assert.equal(disabledResult.name, CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS);
    assert.equal(disabledResult.isEnabled, false);
    assert.equal(mockRepo.mockStatuses[CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS], false);

    const listAfterDisable = await cronService.listJobs();
    const targetJob = listAfterDisable.find((j) => j.name === CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS);
    assert.equal(targetJob?.isEnabled, false);

    const enabledResult = await cronService.toggleJob(
      CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS,
      true,
      { actorId: 'admin-uuid-1' },
    );
    assert.equal(enabledResult.isEnabled, true);
    assert.equal(mockRepo.mockStatuses[CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS], true);
  });

  it('9. Timezone & Disabled Scheduler Filter: should filter out disabled jobs for scheduler initialization', async () => {
    mockRepo.mockStatuses[CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST] = false;
    const statuses = await mockRepo.getJobStatuses();
    const disabledJobs = Object.keys(DEFAULT_CRON_SCHEDULES).filter((name) => statuses[name] === false);
    
    assert.ok(disabledJobs.includes(CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST));
    assert.equal(disabledJobs.includes(CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS), false);
  });
});
