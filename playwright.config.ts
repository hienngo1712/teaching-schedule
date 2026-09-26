// Nạp .env.test + toàn bộ guard chống chạy nhầm production TRƯỚC mọi thứ khác.
// File config này được đánh giá trước khi webServer spawn, nên tiến trình con
// kế thừa DATABASE_URL đã được thay bằng endpoint test.
import './tests/env-setup';

import { defineConfig, devices } from '@playwright/test';

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
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // test-timeout phải LỚN HƠN expect.timeout: nếu bằng hoặc nhỏ hơn, assertion
  // không bao giờ kịp tự báo lỗi — test luôn chết trước bằng "Test timeout exceeded"
  // chung chung, mất thông tin chẩn đoán của chính assertion đó.
  timeout: 90000,
  expect: {
    // 30s: lượt đầu tiên phải chờ next dev biên dịch nguội (Server Action + cold
    // Neon connection); reuseExistingServer: false nên lần nào cũng gặp trạng thái nguội.
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    // Truyền env TƯỜNG MINH thay vì dựa vào kế thừa ngầm — đọc config là thấy
    // ngay server chạy DB nào.
    env: {
      DATABASE_URL: requireEnv('DATABASE_URL'),
      DIRECT_URL: requireEnv('DIRECT_URL'),
      NODE_ENV: 'development',
      // Env phân gói cho DB test: admin_test là admin, TK ngân hàng giả để trang Gói có QR.
      ADMIN_USERNAMES: 'admin_test',
      PLAN_BANK_BIN: '970436',
      PLAN_BANK_ACCOUNT_NUMBER: '0123456789',
      PLAN_BANK_ACCOUNT_NAME: 'CHU APP TEST',
    },
    // PHẢI là false. `true` sẽ tái dùng server đang chạy sẵn ở cổng 3000 —
    // mà server đó nhiều khả năng do `pnpm dev` thường ngày khởi, đang trỏ
    // vào .env (production). Bản vá env sẽ vô nghĩa nếu vẫn reuse.
    reuseExistingServer: false,
    timeout: 120000,
  },
});
