export const CRON_QUEUE_NAME = 'cron-scheduler-queue';

export const CRON_JOB_NAMES = {
  CLEANUP_AUDIT_LOGS: 'cleanup-audit-logs',
  CLEANUP_UNCONFIRMED_UPLOADS: 'cleanup-unconfirmed-uploads',
  CLEANUP_EXPIRED_TOKENS: 'cleanup-expired-tokens',
  DAILY_SUMMARY_DIGEST: 'daily-summary-digest',
  WEEKLY_SUMMARY_DIGEST: 'weekly-summary-digest',
} as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES];

export const DEFAULT_CRON_SCHEDULES: Record<CronJobName, { cron: string; description: string }> = {
  'cleanup-audit-logs': {
    cron: '0 2 * * *', // Daily at 02:00 AM (Asia/Ho_Chi_Minh - UTC+7)
    description: 'Dọn dẹp các bản ghi Audit Logs cũ hơn 7 ngày',
  },
  'cleanup-unconfirmed-uploads': {
    cron: '0 3 * * *', // Daily at 03:00 AM (Asia/Ho_Chi_Minh - UTC+7)
    description: 'Quét và xóa các file upload rác/không xác nhận (avatars, themes) trên Cloudflare R2 / S3',
  },
  'cleanup-expired-tokens': {
    cron: '0 4 * * *', // Daily at 04:00 AM (Asia/Ho_Chi_Minh - UTC+7)
    description: 'Dọn dẹp các Refresh Tokens, Verification Tokens và Password Reset Tokens đã hết hạn',
  },
  'daily-summary-digest': {
    cron: '0 8 * * *', // Daily at 08:00 AM (Asia/Ho_Chi_Minh - UTC+7)
    description: 'Tổng hợp số liệu hoạt động trong ngày và gửi email báo cáo tới Quản trị viên',
  },
  'weekly-summary-digest': {
    cron: '0 8 * * 1', // Mondays at 08:00 AM (Asia/Ho_Chi_Minh - UTC+7)
    description: 'Tổng hợp số liệu hoạt động trong tuần và gửi email báo cáo tới Quản trị viên',
  },
};

export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 7;
export const DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS = 24;
export const CRON_JOB_STATUSES_CONFIG_KEY = 'CRON_JOB_STATUSES';
