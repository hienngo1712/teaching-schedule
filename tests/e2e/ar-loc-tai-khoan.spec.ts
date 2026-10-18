import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// Spec AR §1: màn Tài khoản tìm theo tên, mặc định Mới nhất, đổi Cũ nhất; 375 + 1280 không cuộn ngang.
test.describe.configure({ mode: 'serial' });

const db = new PrismaClient();
const SHOTS = '../student-managerment/.superpowers/mockups/aj/that-ar';
const NAME = `e2e_ar_${Date.now()}`;
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 900 },
];

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await db.user.deleteMany({ where: { username: { startsWith: 'e2e_ar_' } } });
  await db.user.create({ data: { username: NAME, passwordHash: await bcrypt.hash('matkhau-ar-e2e', 4), fullName: 'GV AR E2E' } });
});

test.afterAll(async () => {
  await db.user.deleteMany({ where: { username: { startsWith: 'e2e_ar_' } } });
  await db.$disconnect();
});

async function adminPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await page.goto('/admin/accounts');
  return page;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

for (const vp of VIEWPORTS) {
  test(`${vp.width}px: mặc định Mới nhất, tìm tên → 1 dòng, Cũ nhất → TK mới xuống cuối`, async ({ browser }) => {
    const page = await adminPage(browser, vp);
    const mobile = vp.width < 768;
    // 375: thẻ; 1280: dòng bảng (bỏ dòng tiêu đề).
    const items = mobile ? page.getByTestId('admin-user-card') : page.locator('tbody tr');
    await expect(items.first()).toContainText(NAME);
    const total = await items.count();
    expect(total).toBeGreaterThan(1);
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/loc-tai-khoan-${vp.width}.png` });

    const search = page.getByPlaceholder('Tìm tên đăng nhập hoặc họ tên');
    await search.fill(NAME);
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(NAME);
    await search.fill('');
    await expect(items).toHaveCount(total);

    await page.getByRole('combobox', { name: 'Sắp xếp' }).click();
    await page.getByRole('option', { name: 'Cũ nhất' }).click();
    if (total < 20) await expect(items.last()).toContainText(NAME);
    else await expect(items.filter({ hasText: NAME })).toHaveCount(0);
    await expect(items.first()).not.toContainText(NAME);

    if (mobile) {
      await page.getByRole('button', { name: /^Bộ lọc/ }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByLabel('Tạo từ ngày')).toBeVisible();
      await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}/loc-tai-khoan-sheet-375.png` });
    }
    await page.context().close();
  });
}
