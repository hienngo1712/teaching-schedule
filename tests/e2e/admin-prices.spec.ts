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
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/overview$/ : /.*dashboard/);
  return page;
}

// tests/setup.ts không xóa bảng giá: dọn dòng test để file e2e khác thấy 49.000/99.000.
async function resetPrices() {
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: 'migration' } } });
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetPrices();
  await resetStd();
});

test.beforeEach(async () => {
  await resetPrices();
});

test.afterEach(async () => {
  await resetPrices();
});

test.afterAll(async () => {
  await resetPrices();
  await resetStd();
  await db.$disconnect();
});

test('desktop: admin sửa giá Plus (xem trước, lỗi tại chỗ, xác nhận) → lịch sử; giáo viên thấy giá mới ở /plan và popup', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await admin.locator('aside').getByRole('link', { name: 'Bảng giá' }).click();
  await expect(admin).toHaveURL(/\/admin\/prices$/);
  await expect(admin.getByRole('heading', { level: 1, name: 'Bảng giá' })).toBeVisible();

  const form = admin.getByTestId('admin-prices-form');
  const plus = form.getByTestId('price-plus');
  const pro = form.getByTestId('price-pro');
  const plusInput = plus.getByRole('textbox', { name: 'Giá tháng Plus' });
  const proInput = pro.getByRole('textbox', { name: 'Giá tháng Pro' });
  const save = form.getByRole('button', { name: 'Lưu bảng giá' });
  await expect(plusInput).toHaveValue('49,000');
  await expect(proInput).toHaveValue('99,000');
  await expect(plus).toContainText('12 tháng: 490.000 đ');
  await expect(plus).toContainText('24 tháng: 980.000 đ');
  await expect(save).toBeDisabled();

  await plusInput.fill('59000');
  await expect(plus).toContainText('12 tháng: 590.000 đ');
  await expect(plus).toContainText('24 tháng: 1.180.000 đ');
  await expect(plus).toContainText('Hiện tại: 49.000 đ/tháng');
  await plusInput.fill('59900');
  await expect(plus).toContainText('12 tháng: 599.000 đ');
  await expect(plus).toContainText('24 tháng: 1.198.000 đ');
  await expect(save).toBeEnabled();
  await plusInput.fill('9000');
  await expect(plus).toContainText('Giá tháng từ 10.000 đến 1.000.000');
  await expect(save).toBeDisabled();
  await plusInput.fill('59000');
  await proInput.fill('50000');
  await expect(pro).toContainText('Giá Pro phải cao hơn giá Plus');
  await expect(save).toBeDisabled();
  await proInput.fill('99000');
  await expect(save).toBeEnabled();

  await save.click();
  const confirm = admin.getByTestId('price-confirm');
  await expect(confirm).toContainText('Đổi bảng giá?');
  for (const s of ['49.000 đ', '59.000 đ', '490.000 đ', '590.000 đ', '980.000 đ', '1.180.000 đ']) await expect(confirm).toContainText(s);
  await expect(confirm).not.toContainText('Pro');
  await confirm.getByRole('button', { name: 'Xác nhận đổi giá' }).click();
  await expect(admin.getByText('Đã cập nhật bảng giá')).toBeVisible();
  await expect(confirm).toBeHidden();
  await expect(plusInput).toHaveValue('59,000');
  await expect(save).toBeDisabled();
  const row = admin.getByRole('row').filter({ hasText: 'admin_test' }).first();
  await expect(row).toContainText('Plus');
  await expect(row).toContainText('49.000 đ → 59.000 đ');
  expect(await db.planPriceChange.count({ where: { changedBy: 'admin_test' } })).toBe(1);
  await admin.context().close();

  const std = await loginAs(browser, 'teacher_std', DESKTOP);
  await std.goto('/plan');
  const card = std.getByTestId('plan-card-plus');
  await expect(card).toContainText('59.000 đ');
  await expect(card).toContainText('590.000 đ');
  await expect(card).toContainText('1.180.000 đ');
  await card.getByRole('button', { name: 'Chọn gói Plus' }).click();
  const popup = std.getByTestId('plan-purchase');
  await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
  await expect(popup.getByTestId('purchase-summary')).toContainText('590.000 đ');
  await std.context().close();
});

test('390px: tab bar 6 tab ≥44px, form Pro trên Plus, ô/nút ≥44px, lịch sử dạng thẻ, không tràn ngang', async ({ browser }) => {
  await db.planPriceChange.create({ data: { plan: 'plus', monthPrice: 59000, previousMonthPrice: 49000, changedBy: 'e2e_price' } });
  const admin = await loginAs(browser, 'admin_test', MOBILE);
  const tabs = admin.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(6);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await tabs.getByRole('link', { name: 'Bảng giá' }).click();
  await expect(admin).toHaveURL(/\/admin\/prices$/);

  const y = async (id: string) => (await admin.getByTestId(id).boundingBox())!.y;
  expect(await y('price-pro')).toBeLessThan(await y('price-plus'));
  const plusInput = admin.getByRole('textbox', { name: 'Giá tháng Plus' });
  await expect(plusInput).toHaveValue('59,000');
  for (const box of [plusInput, admin.getByRole('textbox', { name: 'Giá tháng Pro' })]) {
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(admin.getByTestId('price-history-card').filter({ hasText: 'e2e_price' })).toContainText('Plus · 49.000 đ → 59.000 đ');

  await plusInput.fill('69000');
  const save = admin.getByRole('button', { name: 'Lưu bảng giá' });
  expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await save.click();
  const confirm = admin.getByTestId('price-confirm');
  // Hộp đang zoom-in-95 thì boundingBox thấp hơn thật: chờ animation xong mới đo.
  await confirm.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  for (const b of await confirm.getByRole('button').all()) {
    expect((await b.boundingBox())!.height, (await b.textContent()) ?? '').toBeGreaterThanOrEqual(44);
  }
  await confirm.getByRole('button', { name: 'Hủy' }).click();
  await expect(confirm).toBeHidden();
  expect(await db.planPriceChange.count({ where: { plan: 'plus', monthPrice: 69000 } })).toBe(0);

  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await admin.context().close();
});
