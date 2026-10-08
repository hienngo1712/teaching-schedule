import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const CODE_RE = /SM ([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6})/;

async function loginAs(browser: Browser, username: string, viewport = MOBILE): Promise<Page> {
  const context = await browser.newContext({ viewport });
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
  // Admin bị middleware chuyển thẳng về khu quản trị (spec J Q3, spec K N2).
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/overview$/ : /.*dashboard/);
  return page;
}

async function createPendingForStd(prefix: string) {
  const std = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
  const code = prefix + Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  const order = await db.planOrder.create({ data: { userId: std.id, plan: 'plus', period: 'month', amount: 49000, code, status: 'pending' } });
  return { code, order };
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

test('teacher_std tạo đơn Plus tháng → admin_test xác nhận ở /admin/orders → Tài khoản & gói, Lịch sử đơn cập nhật', async ({ browser }) => {
  const std = await loginAs(browser, 'teacher_std');
  await std.goto('/plan');
  await std.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
  const popup = std.getByTestId('plan-purchase');
  await popup.getByTestId('purchase-period-month').click();
  await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
  const pending = popup.getByTestId('pending-order');
  await expect(pending).toBeVisible();
  const code = ((await pending.textContent()) ?? '').match(CODE_RE)![1];
  await std.context().close();

  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin/orders');
  await expect(admin.getByRole('heading', { level: 1, name: 'Chờ xác nhận' })).toBeVisible();
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

  await admin.goto('/admin/accounts');
  await expect(admin.getByRole('heading', { level: 1, name: 'Tài khoản & gói' })).toBeVisible();
  await expect(admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' })).toContainText('Plus');

  await admin.goto('/admin/history');
  const hist = admin.getByTestId('admin-history-card').filter({ hasText: code });
  await expect(hist).toContainText('Đã xác nhận');
  await expect(hist).toContainText('admin_test');
  await expect(hist).toContainText('Hạn cấp');
  await admin.context().close();

  const std2 = await loginAs(browser, 'teacher_std');
  await std2.goto('/plan');
  const plusCard = std2.getByTestId('plan-card-plus');
  await expect(plusCard).toContainText('Đang dùng');
  await expect(std2.getByTestId('plan-current')).toContainText('Gói hiện tại: Plus');
  await expect(std2.getByTestId('plan-current')).toContainText('Dùng đến hết ngày');
  await expect(std2.getByTestId('current-plan')).toHaveCount(0);
  await std2.context().close();
});

test('/admin → /admin/overview; teacher vào /admin, /admin/overview, /admin/orders, /admin/accounts, /admin/history, /admin/prices, /admin/revenue → 404', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin');
  await expect(admin).toHaveURL(/\/admin\/overview$/);
  await admin.context().close();

  const teacher = await loginAs(browser, 'teacher');
  for (const path of ['/admin', '/admin/overview', '/admin/orders', '/admin/accounts', '/admin/history', '/admin/prices', '/admin/revenue']) {
    const res = await teacher.goto(path);
    expect(res!.status(), path).toBe(404);
  }
  await teacher.context().close();
});

test('admin bấm Từ chối → hộp xác nhận; Hủy thì đơn vẫn chờ, xác nhận thì bị từ chối và vào Lịch sử đơn', async ({ browser }) => {
  const { code, order } = await createPendingForStd('RJ');

  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin/orders');
  const card = admin.getByTestId('pending-order-card').filter({ hasText: code });
  await card.getByRole('button', { name: 'Từ chối' }).click();
  const confirm = admin.getByRole('alertdialog');
  await expect(confirm).toContainText(code);
  await confirm.getByRole('button', { name: 'Hủy' }).click();
  await expect(confirm).toBeHidden();
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('pending');

  await card.getByRole('button', { name: 'Từ chối' }).click();
  await confirm.getByRole('button', { name: 'Từ chối' }).click();
  await expect(admin.getByText('Đã từ chối đơn')).toBeVisible();
  await expect(card).toHaveCount(0);
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('rejected');

  await admin.goto('/admin/history');
  await expect(admin.getByTestId('admin-history-card').filter({ hasText: code })).toContainText('Bị từ chối');
  await admin.context().close();
});

test('desktop: sidebar khu quản trị 7 mục, nhãn Quản trị, số đơn chờ; không có mục giáo viên', async ({ browser }) => {
  await createPendingForStd('SB');
  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await admin.goto('/admin/orders');
  const aside = admin.locator('aside');
  await expect(aside.getByText('Quản trị', { exact: true })).toBeVisible();
  expect(await aside.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
    '/admin/overview',
    '/admin/orders',
    '/admin/accounts',
    '/admin/history',
    '/admin/prices',
    '/admin/revenue',
    '/admin/feedback',
  ]);
  await expect(aside).not.toContainText('Học phí');
  const pendingCount = await db.planOrder.count({ where: { status: 'pending' } });
  await expect(aside.getByTestId('admin-pending-count')).toHaveText(String(pendingCount));
  await aside.getByRole('link', { name: 'Lịch sử đơn' }).click();
  await expect(admin).toHaveURL(/\/admin\/history$/);
  await expect(aside.getByRole('link', { name: 'Lịch sử đơn' })).toHaveAttribute('aria-current', 'page');
  await admin.context().close();
});

test('admin_test: route giáo viên → /admin/overview; tab bar và menu avatar chỉ của khu quản trị; không gọi plan.me; không tràn ngang', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test');
  const planMe: string[] = [];
  admin.on('request', (r) => {
    if (r.url().includes('plan.me')) planMe.push(r.url());
  });

  for (const path of ['/dashboard', '/students', '/plan', '/', '/admin', '/api/backup']) {
    await admin.goto(path);
    await expect(admin, path).toHaveURL(/\/admin\/overview$/);
  }
  await expect(admin.getByRole('heading', { level: 1, name: 'Tổng quan' })).toBeVisible();
  await expect(admin.getByRole('banner').getByRole('button', { name: 'Gia hạn' })).toHaveCount(0);

  const tabs = admin.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(7);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(tabs).not.toContainText('Học phí');
  await tabs.getByRole('link', { name: 'Lịch sử' }).click();
  await expect(admin).toHaveURL(/\/admin\/history$/);

  await admin.getByRole('button', { name: 'Mở menu tài khoản' }).click();
  const menu = admin.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Quản trị', /^HD sử dụng/, 'Đổi mật khẩu', 'Đăng xuất']);
  await menu.getByRole('menuitem', { name: 'Quản trị' }).click();
  await expect(admin).toHaveURL(/\/admin\/overview$/);

  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(planMe).toEqual([]);
  await admin.context().close();
});
