import { test, expect, type Page } from '@playwright/test';

// Dev server in thông báo hydration đầy đủ (prod chỉ có mã #418).
const HYDRATION = /hydrat|did not match|#418/i;
const PATHS = ['/students', '/dashboard', '/calendar', '/tuition'];

async function visit(page: Page, path: string) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && HYDRATION.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => { if (HYDRATION.test(e.message)) errors.push(e.message); });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
}

for (const path of PATHS) {
  test(`${path}: không có lỗi hydration`, async ({ page }) => {
    await visit(page, path);
  });
}

// Giờ / định dạng máy người dùng khác máy chủ là nguồn lệch hay gặp.
test.describe('múi giờ VN, locale vi-VN', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' });
  for (const path of PATHS) {
    test(`${path}: không có lỗi hydration`, async ({ page }) => {
      await visit(page, path);
    });
  }
});

// Ngôn ngữ đọc từ localStorage ở client, server luôn render tiếng Việt.
test.describe('ngôn ngữ en', () => {
  for (const path of PATHS) {
    test(`${path}: không có lỗi hydration`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('language', 'en'));
      await visit(page, path);
    });
  }
});
