import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SYSTEM_PERMISSIONS = [
  // User Management
  { name: 'USER_READ', resource: 'USER', action: 'READ', description: 'Xem danh sách và chi tiết người dùng' },
  { name: 'USER_CREATE', resource: 'USER', action: 'CREATE', description: 'Tạo tài khoản người dùng mới' },
  { name: 'USER_UPDATE', resource: 'USER', action: 'UPDATE', description: 'Cập nhật trạng thái và thông tin người dùng' },
  { name: 'USER_DELETE', resource: 'USER', action: 'DELETE', description: 'Xóa mềm người dùng' },
  { name: 'USER_ROLE_ASSIGN', resource: 'USER', action: 'ASSIGN_ROLE', description: 'Phân vai trò cho người dùng' },

  // Role & Permission Management
  { name: 'ROLE_READ', resource: 'ROLE', action: 'READ', description: 'Xem danh sách vai trò và phân quyền' },
  { name: 'ROLE_CREATE', resource: 'ROLE', action: 'CREATE', description: 'Tạo vai trò mới' },
  { name: 'ROLE_UPDATE', resource: 'ROLE', action: 'UPDATE', description: 'Chỉnh sửa thông tin vai trò' },
  { name: 'ROLE_DELETE', resource: 'ROLE', action: 'DELETE', description: 'Xóa vai trò' },
  { name: 'PERMISSION_READ', resource: 'PERMISSION', action: 'READ', description: 'Xem danh mục quyền hệ thống' },
  { name: 'ROLE_PERMISSION_ASSIGN', resource: 'ROLE_PERMISSION', action: 'ASSIGN', description: 'Gán và thu hồi quyền của vai trò' },

  // Notifications & Emails
  { name: 'NOTIFICATION_READ', resource: 'NOTIFICATION', action: 'READ', description: 'Xem danh sách và lịch sử email/thông báo hệ thống' },
  { name: 'NOTIFICATION_CREATE', resource: 'NOTIFICATION', action: 'CREATE', description: 'Tạo và bắn thông báo tới người dùng / toàn hệ thống' },
  { name: 'NOTIFICATION_UPDATE', resource: 'NOTIFICATION', action: 'UPDATE', description: 'Kích hoạt retry gửi lại email bị lỗi' },
  { name: 'NOTIFICATION_DELETE', resource: 'NOTIFICATION', action: 'DELETE', description: 'Xóa thông báo và nhật ký email' },
  { name: 'NOTIFICATION_TEMPLATE_READ', resource: 'NOTIFICATION_TEMPLATE', action: 'READ', description: 'Xem danh sách và chi tiết mẫu thông báo/email' },
  { name: 'NOTIFICATION_TEMPLATE_MANAGE', resource: 'NOTIFICATION_TEMPLATE', action: 'MANAGE', description: 'Quản lý, tạo mới, cập nhật và test mẫu thông báo' },

  // Audit Logs
  { name: 'AUDIT_LOG_READ', resource: 'AUDIT_LOG', action: 'READ', description: 'Xem nhật ký kiểm toán hệ thống' },

  // System Maintenance
  { name: 'MAINTENANCE_READ', resource: 'MAINTENANCE', action: 'READ', description: 'Xem trạng thái và cấu hình bảo trì hệ thống' },
  { name: 'MAINTENANCE_MANAGE', resource: 'MAINTENANCE', action: 'MANAGE', description: 'Bật/tắt và quản lý lịch bảo trì hệ thống' },
  { name: 'MAINTENANCE_BYPASS', resource: 'MAINTENANCE', action: 'BYPASS', description: 'Truy cập hệ thống khi đang bật chế độ bảo trì' },

  // API Keys & Integrations
  { name: 'API_KEY_READ', resource: 'API_KEY', action: 'READ', description: 'Xem danh sách và chi tiết API Keys' },
  { name: 'API_KEY_MANAGE', resource: 'API_KEY', action: 'MANAGE', description: 'Tạo, thu hồi và quản lý API Keys' },

  // Webhooks
  { name: 'WEBHOOK_READ', resource: 'WEBHOOK', action: 'READ', description: 'Xem danh sách Webhook Endpoints và lịch sử giao nhận' },
  { name: 'WEBHOOK_MANAGE', resource: 'WEBHOOK', action: 'MANAGE', description: 'Đăng ký, cấu hình và kích hoạt retry Webhook deliveries' },

  // System Configuration & Feature Flags
  { name: 'SYSTEM_CONFIG_READ', resource: 'SYSTEM_CONFIG', action: 'READ', description: 'Xem danh sách cấu hình hệ thống & feature flags' },
  { name: 'SYSTEM_CONFIG_MANAGE', resource: 'SYSTEM_CONFIG', action: 'MANAGE', description: 'Tạo, cập nhật và quản lý cấu hình hệ thống' },

  // Scheduled / Cron Jobs Management
  { name: 'CRON_JOB_READ', resource: 'CRON_JOB', action: 'READ', description: 'Xem trạng thái và lịch sử chạy scheduled/cron jobs' },
  { name: 'CRON_JOB_MANAGE', resource: 'CRON_JOB', action: 'MANAGE', description: 'Kích hoạt thủ công hoặc cấu hình cron jobs' },

  // Keyboard Themes Management
  { name: 'KEYBOARD_READ', resource: 'KEYBOARD', action: 'READ', description: 'Xem danh sách và chi tiết quản trị Keyboard Themes' },
  { name: 'KEYBOARD_CREATE', resource: 'KEYBOARD', action: 'CREATE', description: 'Tạo mới Keyboard Theme' },
  { name: 'KEYBOARD_UPDATE', resource: 'KEYBOARD', action: 'UPDATE', description: 'Chỉnh sửa Keyboard Theme, đổi trạng thái và cập nhật ảnh' },
  { name: 'KEYBOARD_DELETE', resource: 'KEYBOARD', action: 'DELETE', description: 'Xóa hoặc lưu trữ (archive) Keyboard Theme' },
  { name: 'KEYBOARD_LIKE_READ', resource: 'KEYBOARD_LIKE', action: 'READ', description: 'Xem danh sách bàn phím đã yêu thích của người dùng' },

  // Categories Management
  { name: 'CATEGORY_READ', resource: 'CATEGORY', action: 'READ', description: 'Xem danh sách danh mục quản trị' },
  { name: 'CATEGORY_CREATE', resource: 'CATEGORY', action: 'CREATE', description: 'Tạo mới danh mục' },
  { name: 'CATEGORY_UPDATE', resource: 'CATEGORY', action: 'UPDATE', description: 'Chỉnh sửa danh mục' },
  { name: 'CATEGORY_DELETE', resource: 'CATEGORY', action: 'DELETE', description: 'Xóa danh mục' },

  // Colors Management
  { name: 'COLOR_READ', resource: 'COLOR', action: 'READ', description: 'Xem danh sách màu sắc quản trị' },
  { name: 'COLOR_CREATE', resource: 'COLOR', action: 'CREATE', description: 'Tạo mới màu sắc' },
  { name: 'COLOR_UPDATE', resource: 'COLOR', action: 'UPDATE', description: 'Chỉnh sửa màu sắc' },
  { name: 'COLOR_DELETE', resource: 'COLOR', action: 'DELETE', description: 'Xóa màu sắc' },

  // Styles Management
  { name: 'STYLE_READ', resource: 'STYLE', action: 'READ', description: 'Xem danh sách phong cách quản trị' },
  { name: 'STYLE_CREATE', resource: 'STYLE', action: 'CREATE', description: 'Tạo mới phong cách' },
  { name: 'STYLE_UPDATE', resource: 'STYLE', action: 'UPDATE', description: 'Chỉnh sửa phong cách' },
  { name: 'STYLE_DELETE', resource: 'STYLE', action: 'DELETE', description: 'Xóa phong cách' },

  // Creator Studio & Creator Management
  { name: 'STUDIO_ACCESS', resource: 'STUDIO', action: 'ACCESS', description: 'Truy cập Creator Studio' },
  { name: 'CREATOR_MANAGE', resource: 'CREATOR', action: 'MANAGE', description: 'Quản lý tài khoản và xét duyệt Creator' },

  // Discord Import Management
  { name: 'IMPORT_READ', resource: 'IMPORT', action: 'READ', description: 'Xem danh sách và chi tiết Import Jobs và Keyboard Drafts' },
  { name: 'IMPORT_MANAGE', resource: 'IMPORT', action: 'MANAGE', description: 'Tạo, chỉnh sửa, từ chối và chạy lại Import Jobs' },
  { name: 'IMPORT_APPROVE', resource: 'IMPORT', action: 'APPROVE', description: 'Duyệt và publish Keyboard Draft từ Discord Import' },
];

const USER_BASE_PERMISSIONS: string[] = [
  'NOTIFICATION_READ',
  'STUDIO_ACCESS',
  'KEYBOARD_LIKE_READ',
];

const MANAGER_PERMISSIONS: string[] = [
  'USER_READ',
  'ROLE_READ',
  'PERMISSION_READ',
  'NOTIFICATION_READ',
  'NOTIFICATION_CREATE',
  'NOTIFICATION_UPDATE',
  'NOTIFICATION_TEMPLATE_READ',
  'MAINTENANCE_READ',
  'AUDIT_LOG_READ',
  'API_KEY_READ',
  'WEBHOOK_READ',
  'SYSTEM_CONFIG_READ',
  'CRON_JOB_READ',
  'KEYBOARD_READ',
  'KEYBOARD_LIKE_READ',
  'CATEGORY_READ',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'COLOR_READ',
  'COLOR_CREATE',
  'COLOR_UPDATE',
  'STYLE_READ',
  'STYLE_CREATE',
  'STYLE_UPDATE',
  'STUDIO_ACCESS',
  'CREATOR_MANAGE',
  'IMPORT_READ',
];

async function main() {
  console.log('Starting Dynamic RBAC Seeding...');

  // 0. Clean up legacy & obsolete permissions from previous schemas (e.g. BUDGET, TRANSACTION, WALLET, REPORT)
  const validPermissionNames = SYSTEM_PERMISSIONS.map((p) => p.name);
  const deletedPerms = await prisma.permission.deleteMany({
    where: {
      name: { notIn: validPermissionNames },
    },
  });
  if (deletedPerms.count > 0) {
    console.log(`Cleaned up ${deletedPerms.count} obsolete permissions from previous projects/schemas`);
  }


  // 1. Seed Permissions
  const permissionMap: Record<string, string> = {};
  for (const perm of SYSTEM_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: true,
      },
      create: {
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: true,
      },
    });
    permissionMap[perm.name] = record.id;
  }
  console.log(`Upserted ${Object.keys(permissionMap).length} system permissions`);

  // 2. Seed System Roles
  const roles = [
    { name: 'ADMIN', description: 'Quản trị viên toàn quyền hệ thống', isSystem: true },
    { name: 'MANAGER', description: 'Quản lý nội dung và người dùng', isSystem: true },
    { name: 'CREATOR', description: 'Người sáng tạo giao diện bàn phím', isSystem: true },
    { name: 'USER', description: 'Người dùng thông thường', isSystem: true },
  ];


  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        isSystem: r.isSystem,
      },
      create: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      },
    });
    roleMap[r.name] = role.id;
    console.log(`Role ${r.name} upserted with ID ${role.id}`);
  }

  // 3. Seed Role-Permissions Mapping
  const rolePermissionAssignments: Record<string, string[]> = {
    ADMIN: SYSTEM_PERMISSIONS.map((p) => p.name),
    MANAGER: MANAGER_PERMISSIONS,
    CREATOR: [
      'NOTIFICATION_READ',
      'KEYBOARD_READ',
      'KEYBOARD_CREATE',
      'KEYBOARD_UPDATE',
      'STUDIO_ACCESS',
      'KEYBOARD_LIKE_READ',
    ],
    USER: USER_BASE_PERMISSIONS,
  };

  for (const [roleName, permList] of Object.entries(rolePermissionAssignments)) {
    const roleId = roleMap[roleName];
    for (const permName of permList) {
      const permissionId = permissionMap[permName];
      if (roleId && permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId,
          },
        });
      }
    }
    console.log(`Mapped ${permList.length} permissions to role ${roleName}`);
  }

  // 4. Seed Standard Users & Sample Creator
  const adminEmail = 'admin@template.local';
  const adminPassword = await bcrypt.hash('Admin@123456', 10);

  const managerEmail = 'manager@template.local';
  const managerPassword = await bcrypt.hash('Manager@123456', 10);

  const creatorEmail = 'kurothemes@template.local';
  const creatorPassword = await bcrypt.hash('Creator@123456', 10);

  const userEmail = 'user@template.local';
  const userPassword = await bcrypt.hash('User@123456', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPassword,
      fullName: 'Admin',
      username: 'admin',
      roleId: roleMap['ADMIN'],
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPassword,
      fullName: 'Admin',
      username: 'admin',
      roleId: roleMap['ADMIN'],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      password: managerPassword,
      fullName: 'Manager',
      username: 'manager',
      roleId: roleMap['MANAGER'],
      isActive: true,
    },
    create: {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Manager',
      username: 'manager',
      roleId: roleMap['MANAGER'],
      isActive: true,
    },
  });

  const kuroUser = await prisma.user.upsert({
    where: { email: creatorEmail },
    update: {
      password: creatorPassword,
      fullName: 'Kuro Themes',
      username: 'kurothemes',
      bio: 'Specialized in aesthetic pastel and anime keyboard themes for iOS & Android. 18 themes, 126K downloads, 12K followers.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
      isCreator: true,
      isFeaturedCreator: true,
      socialLinks: {
        twitter: 'https://twitter.com/kurothemes',
        discord: 'https://discord.gg/kurothemes',
      },
      roleId: roleMap['CREATOR'],
      isActive: true,
    },
    create: {
      email: creatorEmail,
      password: creatorPassword,
      fullName: 'Kuro Themes',
      username: 'kurothemes',
      bio: 'Specialized in aesthetic pastel and anime keyboard themes for iOS & Android. 18 themes, 126K downloads, 12K followers.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
      isCreator: true,
      isFeaturedCreator: true,
      socialLinks: {
        twitter: 'https://twitter.com/kurothemes',
        discord: 'https://discord.gg/kurothemes',
      },
      roleId: roleMap['CREATOR'],
      isActive: true,
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      password: userPassword,
      fullName: 'User',
      username: 'user',
      roleId: roleMap['USER'],
      isActive: true,
    },
    create: {
      email: userEmail,
      password: userPassword,
      fullName: 'User',
      username: 'user',
      roleId: roleMap['USER'],
      isActive: true,
    },
  });

  // Seed Follow relation: normalUser follows @kurothemes
  await prisma.userFollow.upsert({
    where: {
      followerId_followingId: {
        followerId: normalUser.id,
        followingId: kuroUser.id,
      },
    },
    update: {},
    create: {
      followerId: normalUser.id,
      followingId: kuroUser.id,
    },
  });

  // 5. Seed Default Maintenance Configuration
  await prisma.maintenanceConfig.upsert({
    where: { key: 'DEFAULT' },
    update: {},
    create: {
      key: 'DEFAULT',
      enabled: false,
      status: 'ONLINE',
      title: 'Hệ thống đang bảo trì',
      message: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.',
      bypassPermissions: ['MAINTENANCE_MANAGE', 'MAINTENANCE_BYPASS'],
      bypassRoles: ['ADMIN'],
      bypassIps: [],
    },
  });
  console.log('MaintenanceConfig default seeded');

  // 6. Seed Default System Notification Templates
  const DEFAULT_TEMPLATES = [
    {
      code: 'VERIFY_EMAIL',
      name: 'Xác thực tài khoản',
      description: 'Email gửi kèm link xác thực khi người dùng đăng ký tài khoản mới',
      channels: ['EMAIL'],
      subject: 'Xác thực tài khoản của bạn',
      title: 'Xác thực tài khoản',
      content: '<p>Chào <strong>{{fullName}}</strong>,</p><p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào nút bên dưới để xác thực email của bạn:</p><div style="text-align: center; margin: 32px 0;"><a href="{{verificationUrl}}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xác thực tài khoản</a></div><p style="color: #666; font-size: 13px;">Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>',
      variables: ['fullName', 'verificationUrl', 'token'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'RESET_PASSWORD',
      name: 'Đặt lại mật khẩu',
      description: 'Email gửi kèm link khôi phục mật khẩu khi người dùng yêu cầu',
      channels: ['EMAIL'],
      subject: 'Đặt lại mật khẩu tài khoản',
      title: 'Đặt lại mật khẩu',
      content: '<p>Chào <strong>{{fullName}}</strong>,</p><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p><div style="text-align: center; margin: 32px 0;"><a href="{{resetUrl}}" style="background-color: #FF5722; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a></div><p style="color: #666; font-size: 13px;">Link có hiệu lực trong 1 giờ. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>',
      variables: ['fullName', 'resetUrl', 'token'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'NEW_DEVICE_ALERT',
      name: 'Cảnh báo đăng nhập thiết bị mới',
      description: 'Thông báo & Email khi phát hiện đăng nhập từ thiết bị lạ',
      channels: ['WEB', 'EMAIL'],
      subject: '⚠️ Cảnh báo: Phát hiện đăng nhập từ thiết bị mới',
      title: 'Phát hiện đăng nhập từ thiết bị mới',
      content: 'Tài khoản của bạn vừa được đăng nhập từ thiết bị: {{deviceName}} (IP: {{ipAddress}}) vào lúc {{loginTime}}.',
      variables: ['fullName', 'deviceName', 'ipAddress', 'loginTime'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'WELCOME',
      name: 'Chào mừng thành viên mới',
      description: 'Thông báo in-app chào mừng sau khi tài khoản được kích hoạt thành công',
      channels: ['WEB'],
      subject: 'Chào mừng bạn đến với hệ thống',
      title: 'Xác thực tài khoản thành công',
      content: 'Chào mừng {{fullName}} đến với hệ thống! Tài khoản của bạn đã được kích hoạt thành công.',
      variables: ['fullName'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'PASSWORD_CHANGED',
      name: 'Đổi mật khẩu thành công',
      description: 'Thông báo cảnh báo bảo mật khi mật khẩu tài khoản thay đổi',
      channels: ['WEB', 'EMAIL'],
      subject: 'Mật khẩu tài khoản đã được thay đổi',
      title: 'Đổi mật khẩu thành công',
      content: 'Mật khẩu tài khoản của bạn vừa được thay đổi thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ quản trị viên ngay lập tức.',
      variables: ['fullName'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'ROLE_ASSIGNED',
      name: 'Cập nhật vai trò tài khoản',
      description: 'Thông báo khi người dùng được gán vai trò mới',
      channels: ['WEB'],
      subject: 'Cập nhật vai trò tài khoản',
      title: 'Cập nhật vai trò tài khoản',
      content: 'Vai trò tài khoản của bạn đã được cập nhật thành: {{roleName}}.',
      variables: ['fullName', 'roleName'],
      isSystem: true,
      isActive: true,
    },
  ];

  for (const tpl of DEFAULT_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { code: tpl.code },
      update: {
        name: tpl.name,
        description: tpl.description,
        channels: tpl.channels,
        subject: tpl.subject,
        title: tpl.title,
        content: tpl.content,
        variables: tpl.variables,
        isSystem: tpl.isSystem,
        isActive: tpl.isActive,
      },
      create: {
        code: tpl.code,
        name: tpl.name,
        description: tpl.description,
        channels: tpl.channels,
        subject: tpl.subject,
        title: tpl.title,
        content: tpl.content,
        variables: tpl.variables,
        isSystem: tpl.isSystem,
        isActive: tpl.isActive,
      },
    });
  }
  console.log('NotificationTemplates default seeded (6 templates)');

  // 7. Seed Default Categories
  const DEFAULT_CATEGORIES = [
    { name: 'Anime', slug: 'anime', icon: 'Sparkles', color: '#FFB7C5', orderIndex: 1, description: 'Giao diện bàn phím phong cách anime, manga dễ thương' },
    { name: 'Pastel', slug: 'pastel', icon: 'Palette', color: '#A2CFFE', orderIndex: 2, description: 'Tông màu pastel dịu nhẹ phong cách Cinnamoroll' },
    { name: 'Cyberpunk', slug: 'cyberpunk', icon: 'Zap', color: '#B57EDC', orderIndex: 3, description: 'Đèn LED neon phong cách tương lai huyền ảo' },
    { name: 'Minimalist', slug: 'minimalist', icon: 'Feather', color: '#CDE4FE', orderIndex: 4, description: 'Thiết kế tối giản, tinh tế, thoáng mắt' },
    { name: 'Gaming', slug: 'gaming', icon: 'Gamepad2', color: '#FFD1DC', orderIndex: 5, description: 'Giao diện bàn phím cơ gaming chuyên nghiệp' },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of DEFAULT_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        orderIndex: cat.orderIndex,
        description: cat.description,
        isActive: true,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        color: cat.color,
        orderIndex: cat.orderIndex,
        description: cat.description,
        isActive: true,
      },
    });
    categoryMap[cat.slug] = record.id;
  }
  console.log('Default Categories seeded (5 categories)');

  // 7b. Seed Default Colors
  const DEFAULT_COLORS = [
    { name: 'Pink', slug: 'pink', hex: '#FFB7C5' },
    { name: 'Purple', slug: 'purple', hex: '#B57EDC' },
    { name: 'White', slug: 'white', hex: '#FFFFFF' },
    { name: 'Blue', slug: 'blue', hex: '#A2CFFE' },
    { name: 'Black', slug: 'black', hex: '#1E1E2E' },
    { name: 'Pastel Blue', slug: 'pastel-blue', hex: '#CDE4FE' },
  ];

  const colorMap: Record<string, string> = {};
  for (const col of DEFAULT_COLORS) {
    const record = await prisma.color.upsert({
      where: { slug: col.slug },
      update: {
        name: col.name,
        hex: col.hex,
      },
      create: {
        name: col.name,
        slug: col.slug,
        hex: col.hex,
      },
    });
    colorMap[col.slug] = record.id;
  }
  console.log('Default Colors seeded (6 colors)');

  // 7c. Seed Default Styles
  const DEFAULT_STYLES = [
    { name: 'Kawaii', slug: 'kawaii', description: 'Cute, anime and soft aesthetic' },
    { name: 'Minimal', slug: 'minimal', description: 'Clean, simple and modern design' },
    { name: 'Cyberpunk', slug: 'cyberpunk', description: 'Futuristic neon-inspired visual style' },
    { name: 'Retro', slug: 'retro', description: 'Vintage, 80s/90s nostalgia aesthetic' },
    { name: 'Glass', slug: 'glass', description: 'Glassmorphism and frosted transparent aesthetic' },
    { name: 'Pixel', slug: 'pixel', description: '8-bit and 16-bit retro pixel art style' },
    { name: 'Neon', slug: 'neon', description: 'Glowing neon vibrant colors' },
    { name: 'Dark', slug: 'dark', description: 'Sleek dark mode aesthetic' },
    { name: 'Pastel', slug: 'pastel', description: 'Gentle, soothing pastel color palette' },
    { name: 'Y2K', slug: 'y2k', description: 'Early 2000s cyber aesthetic' },
  ];

  const styleMap: Record<string, string> = {};
  for (const st of DEFAULT_STYLES) {
    const record = await prisma.style.upsert({
      where: { slug: st.slug },
      update: {
        name: st.name,
        description: st.description,
      },
      create: {
        name: st.name,
        slug: st.slug,
        description: st.description,
      },
    });
    styleMap[st.slug] = record.id;
  }
  console.log('Default Styles seeded (10 styles)');

  // 8. Seed Sample Keyboard Themes for @kurothemes
  const sakuraTheme = await prisma.keyboardTheme.upsert({
    where: { slug: 'sakura-dream' },
    update: {
      name: 'Sakura Dream',
      description: 'Soft pink sakura aesthetic keyboard with custom keycaps and blossom animations.',
      coverUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951',
      driveUrl: 'https://drive.google.com/file/d/1sakuradreamtheme/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      accessLevel: 'FREE',
      downloadCount: 126000,
      likeCount: 3400,
      isFeatured: true,
      publishedAt: new Date(),
      createdBy: kuroUser.id,
    },
    create: {
      name: 'Sakura Dream',
      slug: 'sakura-dream',
      description: 'Soft pink sakura aesthetic keyboard with custom keycaps and blossom animations.',
      coverUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951',
      driveUrl: 'https://drive.google.com/file/d/1sakuradreamtheme/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      accessLevel: 'FREE',
      downloadCount: 126000,
      likeCount: 3400,
      isFeatured: true,
      publishedAt: new Date(),
      createdBy: kuroUser.id,
    },
  });

  if (categoryMap['pastel'] && categoryMap['anime']) {
    await prisma.keyboardThemeCategory.upsert({
      where: {
        keyboardThemeId_categoryId: {
          keyboardThemeId: sakuraTheme.id,
          categoryId: categoryMap['pastel'],
        },
      },
      update: {},
      create: {
        keyboardThemeId: sakuraTheme.id,
        categoryId: categoryMap['pastel'],
      },
    });

    await prisma.keyboardThemeCategory.upsert({
      where: {
        keyboardThemeId_categoryId: {
          keyboardThemeId: sakuraTheme.id,
          categoryId: categoryMap['anime'],
        },
      },
      update: {},
      create: {
        keyboardThemeId: sakuraTheme.id,
        categoryId: categoryMap['anime'],
      },
    });
  }

  // Link Sakura Dream to Colors: pink, white
  if (colorMap['pink']) {
    await prisma.keyboardColor.upsert({
      where: {
        keyboardThemeId_colorId: {
          keyboardThemeId: sakuraTheme.id,
          colorId: colorMap['pink'],
        },
      },
      update: {},
      create: {
        keyboardThemeId: sakuraTheme.id,
        colorId: colorMap['pink'],
      },
    });
  }
  if (colorMap['white']) {
    await prisma.keyboardColor.upsert({
      where: {
        keyboardThemeId_colorId: {
          keyboardThemeId: sakuraTheme.id,
          colorId: colorMap['white'],
        },
      },
      update: {},
      create: {
        keyboardThemeId: sakuraTheme.id,
        colorId: colorMap['white'],
      },
    });
  }

  // Link Sakura Dream to Styles: kawaii, pastel
  if (styleMap['kawaii']) {
    await prisma.keyboardStyle.upsert({
      where: {
        keyboardThemeId_styleId: {
          keyboardThemeId: sakuraTheme.id,
          styleId: styleMap['kawaii'],
        },
      },
      update: {},
      create: {
        keyboardThemeId: sakuraTheme.id,
        styleId: styleMap['kawaii'],
      },
    });
  }
  if (styleMap['pastel']) {
    await prisma.keyboardStyle.upsert({
      where: {
        keyboardThemeId_styleId: {
          keyboardThemeId: sakuraTheme.id,
          styleId: styleMap['pastel'],
        },
      },
      update: {},
      create: {
        keyboardThemeId: sakuraTheme.id,
        styleId: styleMap['pastel'],
      },
    });
  }

  // Seed sample like on Sakura Dream
  await prisma.keyboardLike.upsert({
    where: {
      userId_keyboardThemeId: {
        userId: normalUser.id,
        keyboardThemeId: sakuraTheme.id,
      },
    },
    update: {},
    create: {
      userId: normalUser.id,
      keyboardThemeId: sakuraTheme.id,
    },
  });

  console.log('Sample KeyboardHub Theme seeded');

  // 9. Seed Default System Configurations & Feature Flags
  const { DEFAULT_SYSTEM_CONFIGS } = await import('../src/common/constants/system-config.constant');
  for (const cfg of DEFAULT_SYSTEM_CONFIGS) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {
        description: cfg.description,
        category: cfg.category,
        isPublic: cfg.isPublic,
      },
      create: {
        key: cfg.key,
        value: cfg.value as any,
        description: cfg.description,
        category: cfg.category,
        isPublic: cfg.isPublic,
      },
    });
  }
  console.log(`Default System Configurations & Feature Flags seeded (${DEFAULT_SYSTEM_CONFIGS.length} configs)`);

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

