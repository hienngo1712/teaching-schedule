import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const PREFIX = 'k_new_';
const PASSWORD = 'matkhau-e2e-123';

async function newPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  return page;
}
async function loginAdmin(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const page = await newPage(browser, viewport);
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/overview$/);
  return page;
}
async function registerViaForm(browser: Browser, username: string) {
  const page = await newPage(browser, DESKTOP);
  await page.goto('/register');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="fullName"]', 'GV ' + username);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login/);
  await page.context().close();
}
async function cleanup() {
  const ids = (await db.user.findMany({ where: { username: { startsWith: PREFIX } }, select: { id: true } })).map((u) => u.id);
  if (ids.length === 0) return;
  await db.planOrder.deleteMany({ where: { userId: { in: ids } } });
  await db.trialDayChange.deleteMany({ where: { userId: { in: ids } } });
  await db.subject.deleteMany({ where: { userId: { in: ids } } });
  await db.classUpgradeLog.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

const stamp = Date.now().toString().slice(-6);
const U1 = `${PREFIX}${stamp}a`;
const U2 = `${PREFIX}${stamp}b`;

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test('desktop: đăng ký → admin thấy ở Chờ xác nhận (pill sidebar) → Đã xem; tài khoản 2 → Đặt dùng thử → biến mất', async ({ browser }) => {
  await registerViaForm(browser, U1);
  await registerViaForm(browser, U2);
  const admin = await loginAdmin(browser, DESKTOP);
  await expect(admin.locator('aside').getByTestId('admin-new-accounts-count')).toBeVisible();
  await admin.goto('/admin/orders');
  const section = admin.getByTestId('new-accounts');
  const row1 = section.getByRole('row', { name: new RegExp(U1) });
  await expect(row1).toContainText('GV ' + U1);
  await row1.getByRole('button', { name: 'Đã xem' }).click();
  await expect(section.getByRole('row', { name: new RegExp(U1) })).toHaveCount(0);

  const row2 = section.getByRole('row', { name: new RegExp(U2) });
  await row2.getByRole('button', { name: 'Đặt dùng thử' }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').first().fill('30');
  await dialog.getByRole('button', { name: /Lưu/ }).click();
  await expect(section.getByRole('row', { name: new RegExp(U2) })).toHaveCount(0);
  await admin.context().close();
});

test('390px: thẻ new-account-card, nút ≥44px, chấm ở tab bar, Đã xem', async ({ browser }) => {
  const u3 = `${PREFIX}${stamp}c`;
  await registerViaForm(browser, u3);
  const admin = await loginAdmin(browser, MOBILE);
  await expect(admin.getByTestId('admin-tab-new-dot')).toBeAttached();
  await admin.goto('/admin/orders');
  const card = admin.getByTestId('new-account-card').filter({ hasText: u3 });
  await expect(card).toBeVisible();
  for (const name of ['Đã xem', 'Đặt gói', 'Đặt dùng thử']) {
    expect((await card.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await card.getByRole('button', { name: 'Đã xem' }).click();
  await expect(admin.getByTestId('new-account-card').filter({ hasText: u3 })).toHaveCount(0);
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await admin.context().close();
});
