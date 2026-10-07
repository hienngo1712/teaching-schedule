import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function loginAs(browser: Browser, username: string, viewport: { width: number; height: number }): Promise<Page> {
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
  await expect(page).toHaveURL(/\/admin\/overview$/);
  return page;
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
}

// T1–T6/2026 trước ngày ra mắt gói: chỉ có đơn test tự seed (Điều chỉnh so với spec mục 3).
async function seedOrders() {
  const userId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  const rows = [
    { plan: 'plus', period: 'month', amount: 49000, status: 'approved', source: 'user', creditDays: 0, decidedAt: '2026-03-10T03:00:00Z' },
    { plan: 'plus', period: 'year', amount: 490000, status: 'approved', source: 'user', creditDays: 0, decidedAt: '2026-04-15T03:00:00Z' },
    { plan: 'pro', period: 'year', amount: 990000, status: 'approved', source: 'user', creditDays: 120, decidedAt: '2026-05-20T03:00:00Z' },
    // 23:30 ngày 30/6 giờ VN → tháng 6.
    { plan: 'pro', period: 'month', amount: 99000, status: 'approved', source: 'user', creditDays: 0, decidedAt: '2026-06-30T16:30:00Z' },
    { plan: 'pro', period: 'month', amount: 99000, status: 'rejected', source: 'user', creditDays: 0, decidedAt: '2026-05-21T03:00:00Z' },
    { plan: 'pro', period: null, amount: 0, status: 'approved', source: 'admin', creditDays: 0, decidedAt: '2026-04-01T03:00:00Z' },
  ];
  for (const r of rows) {
    await db.planOrder.create({ data: { userId, ...r, decidedAt: new Date(r.decidedAt), decidedBy: 'admin_test' } });
  }
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
  await seedOrders();
});

test.afterAll(async () => {
  await resetStd();
  await db.$disconnect();
});

test('desktop: sidebar → Doanh thu; Năm/Khoảng/Tháng đúng số, biểu đồ, lỗi khoảng ngược', async ({ browser }) => {
  const page = await loginAs(browser, 'admin_test', DESKTOP);
  await page.locator('aside').getByRole('link', { name: 'Doanh thu' }).click();
  await expect(page).toHaveURL(/\/admin\/revenue$/);

  await page.getByRole('radio', { name: 'Năm' }).click();
  await pick(page, 'Chọn năm', '2026');
  await expect(page.locator('tr', { hasText: '03/2026' })).toContainText('49.000 đ');
  await expect(page.locator('tr', { hasText: '04/2026' })).toContainText('490.000 đ');
  await expect(page.locator('tr', { hasText: '05/2026' })).toContainText('990.000 đ');
  await expect(page.locator('tr', { hasText: '06/2026' })).toContainText('99.000 đ');
  const chart = page.getByTestId('revenue-chart');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(12);

  await page.getByRole('radio', { name: 'Khoảng' }).click();
  await pick(page, 'Từ tháng', 'Tháng 1');
  await pick(page, 'Từ năm', '2026');
  await pick(page, 'Đến tháng', 'Tháng 6');
  await pick(page, 'Đến năm', '2026');
  const summary = page.getByTestId('revenue-summary');
  await expect(summary.getByTestId('revenue-total')).toContainText('1.628.000 đ');
  await expect(summary.getByTestId('revenue-total')).toContainText('4 đơn');
  await expect(summary.getByTestId('revenue-kind-new')).toContainText('49.000 đ');
  await expect(summary.getByTestId('revenue-kind-renew')).toContainText('589.000 đ');
  await expect(summary.getByTestId('revenue-kind-upgrade')).toContainText('990.000 đ');
  await expect(summary.getByTestId('revenue-plan-pro')).toContainText('1.089.000 đ');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(6);

  await pick(page, 'Từ tháng', 'Tháng 3');
  await pick(page, 'Đến tháng', 'Tháng 5');
  await expect(summary.getByTestId('revenue-total')).toContainText('1.529.000 đ');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(3);

  await pick(page, 'Từ tháng', 'Tháng 5');
  await pick(page, 'Đến tháng', 'Tháng 3');
  await expect(page.getByTestId('revenue-error')).toHaveText('Tháng kết thúc phải sau tháng bắt đầu');
  await expect(page.getByTestId('revenue-summary')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Tháng' }).click();
  await pick(page, 'Chọn tháng', 'Tháng 6');
  await pick(page, 'Chọn năm', '2026');
  await expect(summary.getByTestId('revenue-total')).toContainText('99.000 đ');
  await expect(summary.getByTestId('revenue-kind-renew')).toContainText('99.000 đ');
  await expect(page.getByTestId('revenue-chart')).toHaveCount(0);
  await page.context().close();
});

test('390px: tab bar 8 tab ≥44px, không tràn ngang, nút/ô chọn ≥44px, bảng dạng thẻ', async ({ browser }) => {
  const page = await loginAs(browser, 'admin_test', MOBILE);
  const tabs = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(8);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await tabs.getByRole('link', { name: 'Doanh thu' }).click();
  await expect(page).toHaveURL(/\/admin\/revenue$/);

  await page.getByRole('radio', { name: 'Khoảng' }).click();
  await pick(page, 'Từ tháng', 'Tháng 1');
  await pick(page, 'Từ năm', '2026');
  await pick(page, 'Đến tháng', 'Tháng 6');
  await pick(page, 'Đến năm', '2026');
  await expect(page.getByTestId('revenue-total')).toContainText('1.628.000 đ');

  for (const name of ['Tháng', 'Khoảng', 'Năm']) {
    expect((await page.getByRole('radio', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const combo of await page.getByRole('combobox').all()) {
    expect((await combo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const cards = page.getByTestId('revenue-month-card');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(5)).toContainText('Tháng 6/2026');
  await expect(cards.nth(5)).toContainText('99.000 đ');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.context().close();
});
