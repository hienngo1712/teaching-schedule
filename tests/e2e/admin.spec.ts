import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const VIEWPORT = { width: 390, height: 844 };

async function loginAs(browser: Browser, username: string): Promise<Page> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  return page;
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
});

test.afterAll(async () => {
  await resetStd();
  await db.$disconnect();
});

test('teacher_std tạo đơn Plus tháng → admin_test xác nhận ở /admin → teacher_std thấy Plus + hạn', async ({ browser }) => {
  const std = await loginAs(browser, 'teacher_std');
  await std.goto('/plan');
  const checkout = std.getByTestId('plan-checkout');
  await checkout.getByRole('button', { name: 'Plus', exact: true }).click();
  await checkout.getByRole('button', { name: 'Tháng', exact: true }).click();
  await checkout.getByRole('button', { name: 'Tạo mã chuyển khoản' }).click();
  const pending = std.getByTestId('pending-order');
  await expect(pending).toBeVisible();
  const code = ((await pending.textContent()) ?? '').match(/SM ([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6})/)![1];
  await std.context().close();

  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin');
  const card = admin.getByTestId('pending-order-card').filter({ hasText: code });
  await expect(card).toBeVisible();
  await expect(card).toContainText('teacher_std');
  await expect(card).toContainText('49.000');
  await card.getByRole('button', { name: 'Xác nhận' }).click();
  const confirm = admin.getByRole('alertdialog');
  await expect(confirm).toContainText(code);
  await expect(confirm).toContainText('Gói Plus dùng đến hết ngày');
  await confirm.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(admin.getByText('Đã xác nhận đơn')).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' })).toContainText('Plus');
  await admin.context().close();

  const std2 = await loginAs(browser, 'teacher_std');
  await std2.goto('/plan');
  const current = std2.getByTestId('current-plan');
  await expect(current).toContainText('Plus');
  await expect(current).toContainText('Đã mua');
  await expect(current).toContainText('Dùng đến hết ngày');
  await std2.context().close();
});

test('teacher vào /admin → 404; admin_test thấy link Trang quản trị ở /plan', async ({ browser }) => {
  const teacher = await loginAs(browser, 'teacher');
  const res = await teacher.goto('/admin');
  expect(res!.status()).toBe(404);
  await teacher.context().close();

  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/plan');
  await expect(admin.getByTestId('admin-link')).toBeVisible();
  await admin.context().close();
});
