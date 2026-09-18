// Nạp .env.test + toàn bộ guard chống chạy nhầm production TRƯỚC mọi thứ khác.
// File config này được đánh giá trước khi webServer spawn, nên tiến trình con
// kế thừa DATABASE_URL đã được thay bằng endpoint test.
import './tests/env-setup';

import { defineConfig, devices } from '@playwright/test';

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
  timeout: 30000,
  expect: {
    timeout: 10000,
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
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      DIRECT_URL: process.env.DIRECT_URL ?? '',
      NODE_ENV: 'development',
    },
    // PHẢI là false. `true` sẽ tái dùng server đang chạy sẵn ở cổng 3000 —
    // mà server đó nhiều khả năng do `pnpm dev` thường ngày khởi, đang trỏ
    // vào .env (production). Bản vá env sẽ vô nghĩa nếu vẫn reuse.
    reuseExistingServer: false,
    timeout: 120000,
  },
});
