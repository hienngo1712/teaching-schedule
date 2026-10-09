// Config riêng để chụp ảnh /guide. Không nằm trong e2e thường: chạy tay khi giao diện đổi.
import './tests/env-setup';
import { defineConfig } from '@playwright/test';

// Chuỗi rỗng vẫn là giá trị "đã định nghĩa" nên @next/env sẽ không ghi đè —
// fallback '' sẽ khiến lỗi thiếu biến bị che thành lỗi Prisma khó hiểu.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu ${name} sau khi nạp .env.test — kiểm tra lại file đó.`);
  }
  return value;
}

export default defineConfig({
  testDir: './tests/guide-shots',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180000,
  expect: { timeout: 30000 },
  use: { baseURL: 'http://localhost:3000', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    env: {
      DATABASE_URL: requireEnv('DATABASE_URL'),
      DIRECT_URL: requireEnv('DIRECT_URL'),
      DATA_ENCRYPTION_KEYS: requireEnv('DATA_ENCRYPTION_KEYS'),
      DATA_ENCRYPTION_ACTIVE_KID: requireEnv('DATA_ENCRYPTION_ACTIVE_KID'),
      NODE_ENV: 'development',
      ADMIN_USERNAMES: 'admin_test',
      PLAN_BANK_BIN: '970436',
      PLAN_BANK_ACCOUNT_NUMBER: '0123456789',
      PLAN_BANK_ACCOUNT_NAME: 'CHU APP TEST',
      // Khoá giả: chỉ để popup mua gói hiện nhóm Cách thanh toán, ảnh không tạo đơn nên không gọi payOS.
      PAYOS_CLIENT_ID: 'test-client',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
      PAYOS_API_BASE: 'http://127.0.0.1:4010',
    },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
