# Project Memory

## Date/time architecture

- `Asia/Ho_Chi_Minh` (UTC+7) là múi giờ chuẩn cho nghiệp vụ tính toán và hiển thị.
- Các trường ngày nghiệp vụ lưu trữ và định dạng dạng `YYYY-MM-DD` tương thích với PostgreSQL `DATE` hoặc `TIMESTAMP`.
- Các mốc thời gian tức thời (Auth expirations, created_at, updated_at, token expiry) dùng ISO 8601 offset-aware.

## Quyết định kiến trúc đang có hiệu lực

- **Layered Architecture**: Tuân thủ nghiêm ngặt ranh giới:
  `route -> validation -> controller -> service -> repository`.
- **Database Access**: Chỉ repository mới được phép gọi Prisma Client; service phụ trách business logic và transaction orchestration.
- **Validation**: Toàn bộ HTTP request input bắt buộc đi qua Zod schema middleware (`body`, `query`, `params`).
- **Error Handling**: API lỗi có chủ đích sử dụng `AppError` kết hợp `ERROR_CODE` trong `src/common/constants/`.
- **Dynamic RBAC Authorization**:
  - Phân quyền theo cơ chế động: `User -> Role -> RolePermission -> Permission`.
  - Middleware bảo vệ endpoint sử dụng `requirePermission('RESOURCE_ACTION')` (hoặc `requireAnyPermission`), không hard-code tên Role trong business authorization.
  - Tối ưu hóa hiệu năng bằng `PermissionCacheService` (in-memory TTL cache) kèm cơ chế tự động xóa cache khi quyền của vai trò thay đổi.
  - Bảo vệ System Roles (`isSystem = true` như `ADMIN`, `MANAGER`, `USER` không thể bị xóa/đổi tên) và chống thu hồi quyền quản trị tối cao `ROLE_PERMISSION_ASSIGN` khỏi `ADMIN` (Anti-lockout).
  - Tự động ghi `AuditLog` cho mọi thao tác tạo/sửa/xóa vai trò, gán quyền và đổi vai trò người dùng.
- **User Authentication & Authorization**:
  - JWT Access Token (short-lived, 15m) và Refresh Token (lưu DB trong bảng `refresh_tokens`).
  - Trả về token và danh sách quyền `permissions: string[]` trong response body JSON (`accessToken`, `refreshToken`) song song với cookie để hỗ trợ Zalo Mini App / WebView client.
  - Hỗ trợ thiết bị đăng nhập qua `UserDevice` và hash thiết bị (`deviceHash` bằng SHA-256).
  - Đổi mật khẩu (`updatePassword`) hoặc reset mật khẩu (`resetPassword`) tự động thu hồi (revoke) toàn bộ Refresh Tokens của user.
- **User Soft Delete & Database Safety**:
  - Sử dụng `deletedAt`, `deletedBy`, vô hiệu hóa user (`isActive = false`) và thu hồi mọi refresh token.
  - Quan hệ `Role` -> `User` cấu hình `onDelete: Restrict` để ngăn chặn rủi ro xóa trắng cơ sở dữ liệu người dùng.
- **Prisma & Migrations**:
  - Database PostgreSQL quản lý bằng Prisma ORM.
  - Đã tối ưu hóa `@@index` cho các bảng cốt lõi (`User`, `Tokens`, `RolePermission`, `AuditLog`, `Notifications`).
  - Đã loại bỏ các bảng cũ của dự án tài chính (`wallets`, `categories`, `transactions`, `budgets`) qua migration `20260822170800_remove_domain_financial_models`.
  - Sử dụng wrapper `scripts/prisma-run.js` cho các tác vụ Prisma CLI để đảm bảo load đúng biến môi trường từ `.env`.
  - Mọi thay đổi schema phải sinh migration mới qua `pnpm run db:migrate`. Không chỉnh sửa migration đã được commit/áp dụng.
  - Tuyệt đối không tự ý chạy `pnpm run db:migrate:reset` trên database đang hoạt động.
- **Automated Testing**: Bộ test tự động đặt tại `tests/`, chạy bằng lệnh `pnpm test` (`tsx --test`).
- **Package Manager**: Dự án sử dụng `pnpm`.

- **System Maintenance Mode**:
  - Module quản lý chế độ bảo trì hệ thống backend tại `src/modules/maintenance/` kết hợp middleware bảo vệ `maintenanceGuard`.
  - Hỗ trợ các trạng thái `ONLINE`, `MAINTENANCE`, `READ_ONLY` (cho phép `GET`/`HEAD`/`OPTIONS` và chặn mutations với 503).
  - Trả về mã lỗi chuẩn `503 Service Unavailable` và response body `{ success: false, code: 'SYSTEM_MAINTENANCE', message: '...', data: { title, message, estimatedEndAt, startAt } }`.
  - Cung cấp API Public `GET /api/v1/maintenance/public` cho các ứng dụng client/frontend truy vấn trạng thái và thời gian hoàn tất.
  - Phân quyền bypass bằng Dynamic RBAC permissions (`MAINTENANCE_MANAGE`, `MAINTENANCE_BYPASS`), bypass roles (`ADMIN`), và bypass IP whitelists (`bypassIps` hỗ trợ IPv4, IPv6 và dải CIDR subnet như `10.0.0.0/8`, `192.168.1.0/24`).
  - Cơ chế Anti-Lockout: Tuyệt đối không chặn các endpoint `/health`, `/api/docs`, `/api/v1/auth/(login|refresh|logout|me|sessions)`, và `/api/v1/maintenance/*`.
  - Tối ưu hóa hiệu năng bằng `MaintenanceCacheService` (in-memory TTL cache) kết hợp **Redis Pub/Sub Cache Invalidation Adapter** (`maintenance:events`) để đồng bộ việc xóa cache tức thời giữa nhiều cluster instances / container pods, kèm cơ chế fallback tự động an toàn khi Redis không khả dụng.
  - Tự động ghi `AuditLog` cho các hành động `ENABLE_MAINTENANCE`, `UPDATE_MAINTENANCE`, `DISABLE_MAINTENANCE`.

## Trạng thái đã biết

- Các endpoint hiện hữu: `/health`, `/auth` (đăng ký, đăng nhập, refresh, me, logout, password reset, verification, sessions), `/users` (quản trị người dùng), `/rbac` (quản trị vai trò, phân quyền, nhật ký kiểm toán audit log), `/notifications` (thông báo & email queue), `/maintenance` (quản trị bảo trì hệ thống).
- Cơ sở dữ liệu sạch chuẩn template với các migration `20260722073204_`, `20260822152200_dynamic_rbac`, `20260822164800_notification_system`, `20260822170800_remove_domain_financial_models`, `20260822173600_add_maintenance_and_audit_index`.
- Cấu hình port: fallback code là `8888` (hoặc `7777` theo `.env.example`).
- Tài liệu Swagger UI tại `/api/docs`.

- **Advanced SSRF Defense & URL Validation** (`src/common/helpers/url.helper.ts`):
  - `isPrivateOrReservedIp(ip)`: Phát hiện mọi địa chỉ IPv4/IPv6 private (10.x, 172.16-31.x, 192.168.x, 169.254.x, CGN 100.64-127.x, Loopback 127.x, ULA fc00::/7, Link-local fe80::/10, Multicast ff00::/8, và IPv4-mapped IPv6 `::ffff:127.0.0.1` / `::ffff:169.254.169.254`).
  - `resolveAndValidateDns(hostname, options)`: Phân giải toàn bộ bản ghi DNS A & AAAA, chống tấn công **DNS Rebinding** và domain public trỏ về IP private.
  - `resolveSafeRedirectChain(urlString, options)`: Theo dõi và xác thực từng bước chuyển hướng **HTTP 301/302/303/307/308 redirect** (tối đa 5 redirects), chặn mọi hành vi chuyển hướng sang private IP, metadata IP, protocol không an toàn (`file:`, `ftp:`, `javascript:`), hoặc redirect loop.
  - `isPublicHttpUrl(url, options)`: Validate cú pháp URL, tự động cho phép localhost trong môi trường `development` (`allowPrivate: true`) và chặn nghiêm ngặt trong `production`.
  - Đã gắn vào Zod validation schema cho `avatarUrl` (`auth.validation.ts`) và `actionUrl` (`notification.validation.ts`).
  - Unit tests đầy đủ tại `tests/helpers.test.ts` (102 tests pass).
- **Multi-Tier Rate Limiting & RFC 6585 Standard** (`src/middlewares/rate-limit.middleware.ts`):
  - Factory `createRateLimiter` sliding-window in-memory kèm cơ chế dọn dẹp định kỳ không rò rỉ bộ nhớ.
  - Trả về đầy đủ HTTP Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` và `Retry-After` (khi chạm 429).
  - `rateLimitMiddleware`: Áp dụng toàn cục `/api/v1` (1000 req/15 phút).
  - `authRateLimitMiddleware`: Áp dụng riêng cho các endpoint nhạy cảm `/register`, `/login`, `/forgot-password`, `/reset-password`, `/resend-verification` (30 req/15 phút) để phòng chống Brute Force và Credential Stuffing.
  - Định nghĩa mã lỗi tập trung `ERROR_CODE.RATE_LIMIT_EXCEEDED`.
- **CORS Production Fail-Safe** (`src/config/env.config.ts`):
  - Bắt buộc khai báo danh sách domain cụ thể qua `ALLOWED_ORIGINS` khi chạy `NODE_ENV=production`.
  - Cấm sử dụng wildcard `'*'` hoặc bỏ trống trong môi trường production để bảo vệ cookie/credentials.
- **Dynamic System Configuration & Feature Flags** (`src/modules/system-config/`):
  - Module quản lý cấu hình động và cờ tính năng (Feature Flags) tại `/api/v1/system/configs`, `/api/v1/system/features/:key/toggle` và endpoint công khai `/api/v1/system/public`.
  - Phân loại theo danh mục: `GENERAL`, `FEATURE_FLAG`, `INTEGRATION`, `SECURITY`.
  - Hỗ trợ đánh giá cờ tính năng tức thời `systemConfigService.isFeatureEnabled(flagKey)` kèm middleware bảo vệ route `requireFeatureFlag('flagKey')`.
  - Tối ưu hóa hiệu năng bằng in-memory TTL caching kết hợp Redis Pub/Sub invalidation (`system_config:events`) và tự động ghi `AuditLog` cho mọi thao tác cấu hình.
  - **Quy tắc bắt buộc**: Mỗi khi thêm tính năng mới, cấu hình tích hợp (OAuth, Discord, Webhook, Bot, Email), cờ tính năng, thông số giới hạn hoặc cấu hình công khai, **BẮT BUỘC** phải khai báo trong `src/common/constants/system-config.constant.ts` và seed trong `prisma/seed.ts`.
- **Production Observability & Deep Diagnostics** (`src/routes/health.route.ts` & `src/middlewares/request-id.middleware.ts`):
  - Middleware `requestIdMiddleware` tự động cấp phát và chuyển tiếp header `X-Request-Id` (UUID) phục vụ truy vết phân tán (distributed tracing).
  - Cung cấp `/api/v1/health` (liveness) và `/api/v1/health/readiness` (thực hiện truy vấn kiểm tra PostgreSQL database live, kiểm tra ping Redis, thu thập thông số heapUsedMb, heapTotalMb, rssMb và uptime).
- **Graceful Shutdown & Resilience** (`src/server.ts`):
  - Xử lý tín hiệu `SIGINT` / `SIGTERM` an toàn: đóng HTTP listener, dừng background workers (`EmailWorker`, `WebhookWorker`), đóng BullMQ queue, ngắt kết nối Redis và Prisma client, kèm failsafe timeout 10 giây.
- **Strict Layer Encapsulation & Worker Concurrency**:
  - Toàn bộ Middlewares (`apiKeyAuthMiddleware`, `permissionMiddleware`), Services (`PermissionCacheService`, `MaintenanceCacheService`, `NotificationDispatcher`, `EmailTemplateService`) và Workers (`EmailWorker`, `WebhookWorker`) truy vấn cơ sở dữ liệu độc quyền qua các Repository (`IntegrationRepository`, `AuthRepository`, `UserRepository`, `RbacRepository`, `MaintenanceRepository`, `NotificationRepository`, `SystemConfigRepository`).
  - `EmailWorker` áp dụng cơ chế khóa hàng nguyên tử `FOR UPDATE SKIP LOCKED` (`NotificationRepository.claimPendingEmails`), triệt tiêu hoàn toàn race condition duplicate email khi chạy multi-pod cluster.
  - `rotateRefreshToken()` áp dụng RFC 6819 Token Family Revocation: tự động thu hồi toàn bộ refresh token của user khi phát hiện hành vi tái sử dụng token đã xoay vòng.
  - Tối ưu hóa `api_keys.last_used_at` với cơ chế debounce 5 phút tránh nghẽn write lock khi tiếp nhận tải cao.
  - Tối ưu hóa composite indexes qua migration `20260824010000_update_notification_indexes`.
- **Automated OpenAPI & Swagger Documentation** (`@asteasolutions/zod-to-openapi`):
  - Tài liệu Swagger UI tại `/api/docs` được sinh tự động và đồng bộ 100% theo thời gian thực từ các Zod Schema trong `*.validation.ts`.
  - Loại bỏ hoàn toàn việc duy trì file tĩnh thủ công 1900 dòng.
  - Mỗi module quản lý OpenAPI route definitions độc lập tại `src/modules/*/*.openapi.ts`, tập trung qua `OpenAPIRegistry` (`src/config/openapi/openapi.registry.ts`).
- **Scheduled Background Tasks & Cron Engine** (`BullMQ Repeatable Jobs`):
  - Module quản lý Cron Jobs tập trung tại `src/modules/cron/` và `src/common/queues/cron.queue.ts`.
  - Hỗ trợ 4 tác vụ định kỳ chính:
    1. `cleanup-audit-logs`: Xóa Audit Logs cũ hơn 30 ngày.
    2. `cleanup-unconfirmed-uploads`: Quét bucket Cloudflare R2 / S3 xóa file avatar rác quá 24h không liên kết user.
    3. `cleanup-expired-tokens`: Dọn dẹp Refresh Token, Verification Token và Password Reset Token đã hết hạn.
    4. `daily-summary-digest` & `weekly-summary-digest`: Tổng hợp KPI hệ thống và gửi email báo cáo tới Quản trị viên.
  - Cung cấp REST endpoints `GET /api/v1/cron/jobs` và `POST /api/v1/cron/jobs/:jobName/trigger` cho phép Admin chủ động kích hoạt chạy ngay kèm Audit Log.
- **Keyboard Theme Library & Catalog System** (`src/modules/keyboard/` & `src/modules/category/`):
  - Hệ thống quản lý thư viện bàn phím phục vụ khám phá, phân loại, tìm kiếm, lọc theo nền tảng (`IOS`, `ANDROID`, `BOTH`), danh mục Many-to-Many (`KeyboardThemeCategory`), và bộ sưu tập ảnh xem trước (`KeyboardImage` có `position`).
  - Hỗ trợ vòng đời Theme 3 trạng thái: `DRAFT`, `PUBLISHED`, `HIDDEN` với quy tắc chuyển trạng thái chặt chẽ.
  - Phân tách tuyệt đối Public DTOs (không bao giờ lộ `driveUrl`, audit fields) và Management DTOs (`KEYBOARD_READ`).
  - Tự động lưu trữ (Archive -> `HIDDEN`) thay vì xóa vật lý khi theme đã có lịch sử tải (`Download` history).
  - Tự động ghi `AuditLog` cho các hành vi `CREATE_KEYBOARD`, `UPDATE_KEYBOARD`, `DELETE_KEYBOARD`, `ARCHIVE_KEYBOARD`, `CREATE_CATEGORY`, `UPDATE_CATEGORY`, `DELETE_CATEGORY`.
- **Discord OAuth Authentication** (`src/modules/auth/discord-oauth.service.ts`):
  - Tích hợp đăng nhập Discord OAuth2 (`identify email`) vào bảng `UserSocial (provider = 'DISCORD')`.
  - Cơ chế phòng chống CSRF Replay Attack với mã `state` dùng 1 lần và TTL 5 phút.
  - Tái sử dụng trọn vẹn JWT Access Token, Refresh Token, Cookie và Session flow hiện có.
- **Download Engine & Security** (`POST /api/v1/keyboards/:slug/download`):
  - Bắt buộc xác thực tài khoản Active (`authMiddleware`).
  - Rate Limiting chuyên biệt 5 requests / 1 phút / user (`downloadRateLimiter`).
  - Thực thi atomic transaction: tạo bản ghi `Download` + tăng `downloadCount` (`increment: 1`) trong Prisma `$transaction`.
  - Phản hồi **HTTP 302 Found Redirect** tới Google Drive URL; fail-safe 500 khi transaction database lỗi.
- **Database Migrations & Models**:
  - Bổ sung migration `20260824160000_add_keyboard_theme_models` cho các bảng `keyboard_themes`, `keyboard_images`, `categories`, `keyboard_theme_categories`, `downloads`.
  - Tối ưu hóa composite indexes (`[status, published_at]`, `[download_count]`, `[platform]`, `[user_id, created_at]`, `[keyboard_theme_id, created_at]`, `[user_id, keyboard_theme_id]`).
- **Full Project Audit & Remediation (2026-08-24)**:
  - Đã khắc phục nhận diện VIP/Booster qua cấu hình `discord.vip_role_ids` trong `SystemConfig`.
  - Khắc phục kiểm tra tài khoản vô hiệu hóa từ cơ sở dữ liệu khi tải theme (`findUserById`).
  - Kích hoạt kết nối `.connect()` cho Redis Pub/Sub Subscriber trong `SystemConfigService` và `MaintenanceCacheService` trên cluster.
  - Chuẩn hóa ranh giới tính hạn mức tải đầu tháng bằng helper `getVietnamDayRange` (UTC+7).
  - Tích hợp email nguyên tử trong `createSocialUser` cho Discord OAuth.
  - Tích hợp phát sóng real-time SSE trong `NotificationDispatcher.dispatchWeb`.
  - Hỗ trợ phân trang `ContinuationToken` cho Cloudflare R2 `listObjects`.
  - **Discord OAuth Security Hardening**:
    - Loại bỏ hoàn toàn Access/Refresh tokens khỏi URL redirect query string; tokens chỉ chuyển phát qua HttpOnly Cookie hoặc JSON response body cho API clients.
    - Ràng buộc mã OAuth `state` với browser session qua HttpOnly `discord_oauth_nonce` cookie để phòng chống triệt để Login CSRF / Session Fixation.
    - Bắt buộc kiểm tra `profile.verified === true` trước khi auto-link tài khoản Discord vào người dùng hiện có để ngăn chặn Account Takeover.
    - Bổ sung `AbortSignal.timeout(8000)` cho các lệnh gọi Discord OAuth / Bot API và map đúng mã lỗi 502/504.
  - **Refresh Token SHA-256 Hashing**:
    - Băm SHA-256 toàn bộ Refresh Token trước khi lưu trữ và truy vấn trong cơ sở dữ liệu (`refresh_tokens` table), tuân thủ RFC 6819 defense-in-depth.
  - **Authorization & Inactive Account Interceptor**:
    - `permissionMiddleware` truy vấn DB trực tiếp để chặn ngay lập tức người dùng bị Admin khóa hoặc hạ quyền, vô hiệu hóa việc lạm dụng JWT cũ.
  - **Publish Invariant Enforcement**:
    - Chặn phát hành (PUBLISHED) qua PATCH khi theme không có danh mục hợp lệ.
  - **Feature Flags Runtime Wiring**:
    - Đã gắn `requireFeatureFlag(FEATURE_FLAGS.DISCORD_LOGIN_ENABLED)` trên Discord auth route; kiểm tra `FEATURE_FLAGS.DISCORD_GATED_DOWNLOAD` và `FEATURE_FLAGS.THEME_ANNOUNCEMENT_WEBHOOK` trong `KeyboardService`.
- **HTTPS Enforcement for Theme Download URLs**:
    - Ép buộc giao thức `https://` và allowlist chính xác các domain Google Drive hoặc Discord hợp lệ; chặn domain giả mạo gần giống.
- **KeyboardHub Platform Transformation (2026-08-26)**:
  - **Themes System (`/api/v1/keyboards`)**:
    - Hỗ trợ đầy đủ tương tác Thả tim (`POST /:slug/like`), danh sách theme đã thích (`GET /me/liked`), và phân loại theo Creator, Platform (iOS/Android/Both), Access Level (Free/Premium/Discord Member/Role).
    - Public responses chuẩn hóa kèm thông tin Creator (`author: { id, fullName, username, avatarUrl }`), `likeCount`, `downloadCount`, `isLiked`.
  - **Creators System (`src/modules/creator/` & `/api/v1/creators`)**:
    - Public Creator Profile (`@username`, bio, avatar, banner, mạng xã hội).
    - Tính toán metrics tức thời: `themesCount`, `downloadsCount`, `followersCount`, `likesCount`.
    - Follow & Unfollow Engine (`POST /:username/follow`) với atomic transaction cập nhật `followerCount`.
    - Endpoint danh sách theo dõi của người dùng (`GET /api/v1/creators/me/following`).
  - **Creator Studio (`src/modules/studio/` & `/api/v1/studio`)**:
    - Cổng quản trị chuyên biệt dành cho Creator: Dashboard tổng hợp metrics, biểu đồ xu hướng tải 30 ngày theo ngày (UTC+7), Top 5 theme thịnh hành.
    - Quản lý theme của creator (đăng theme mới, chỉnh sửa, xóa/archive).
    - Cập nhật hồ sơ Creator & Quy trình đăng ký Creator (`POST /apply`).
  - **Database Migration**:
    - Migration `20260826000000_add_keyboard_hub_platform_models` tạo bảng `keyboard_likes`, `user_follows`, bổ sung các cột và composite indexes vào `users` và `keyboard_themes`.
    - Migration `20260909000000_remove_collections` loại bỏ các bảng và khóa ngoại liên quan đến `collections` và `collection_items`.

## Security Fixes Applied (2026-08-26 — full-project-audit)

- **Token Hash Consistency (BUG-01, BUG-02, BUG-06)**: Toàn bộ token types (`RefreshToken`, `VerificationToken`, `PasswordResetToken`) đều được hash SHA-256 trước khi lưu DB và khi lookup. **KHÔNG bao giờ so sánh raw token với DB value.**
  - `createVerificationToken` / `findVerificationToken` → hash trước khi lưu/lookup
  - `createPasswordResetToken` / `findPasswordResetToken` → hash trước khi lưu/lookup
  - `deleteOtherSessions` → hash `currentToken` trước khi so sánh (dùng `hashToken()`)
  - `getActiveSessions.isCurrent` → hash `currentToken` trước khi compare với `session.token`

- **CORS Wildcard (BUG-05)**: Wildcard `*` trong production bây giờ reject explicitly. Không set `CORS_ALLOWED_ORIGINS=*` trong production.

- **Body Size Limit (BUG-12)**: `express.json()` và `express.urlencoded()` đã có `limit: '512kb'`.

- **Discord Import & AI Draft System (2026-08-30)**:
  - Hệ thống nhập liệu tự động từ Discord Threads: `Discord Thread -> Import Job -> Normalization -> Deterministic Parser -> AI Draft -> Admin Review -> Published Keyboard`.
  - 3 Models mới trong Prisma: `DiscordThread` (lưu metadata và `rawData` JSON nguyên bản), `ImportJob` (trạng thái vòng đời và pha xử lý), `KeyboardDraft` (bản nháp sau parser/AI kèm confidence score và validation flags).
  - Khả năng Idempotent: `POST /api/v1/imports` nhận dữ liệu thô, chống tạo job trùng lặp trên cùng một `discordThreadId`.
  - Deterministic parser: nhận diện nền tảng (`IOS` cho `.bdi`, `ANDROID` cho `.bds`, `BOTH` khi có cả hai hoặc Google Drive link), bóc tách cover và preview ảnh.
  - Phân quyền & Audit Logs: `IMPORT_READ`, `IMPORT_MANAGE`, `IMPORT_APPROVE` kèm `AUDIT_ACTION.CREATE_IMPORT_JOB`, `APPROVE_IMPORT_DRAFT`, `REJECT_IMPORT_DRAFT`, `BULK_APPROVE_IMPORT`, `REPROCESS_IMPORT_JOB`.
  - Feature flags & System configs: `FEATURE_FLAGS.DISCORD_IMPORT_ENABLED`, `FEATURE_FLAGS.AI_IMPORT_ENABLED`, `import.ai_confidence_threshold`, `import.bulk_approve_max`.
  - Admin Bulk Review & Detail Review: giao diện quản trị FE hỗ trợ lọc độ tin cậy cao (≥90%), duyệt hàng loạt và chỉnh sửa chi tiết.
