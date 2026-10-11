import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// Spec AL §5: TK mới → popup chọn nơi dạy + gói. Chỉ dạy trung tâm thì không có Học phí; thêm Lớp tại nhà thì có.
const db = new PrismaClient();
const PREFIX = 'al_reg_';
const PASSWORD = 'matkhau-e2e-123';
const USER = `${PREFIX}${Date.now().toString().slice(-6)}`;

async function cleanup() {
  const ids = (await db.user.findMany({ where: { username: { startsWith: PREFIX } }, select: { id: true } })).map((u) => u.id);
  if (ids.length === 0) return;
  await db.subject.deleteMany({ where: { userId: { in: ids } } });
  await db.trialDayChange.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function registerAndLogin(page: Page, user = USER) {
  await page.goto('/register');
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="fullName"]', 'GV ' + user);
  await page.fill('input[name="password"]', PASSWORD);
  await page.fill('input[name="confirmPassword"]', PASSWORD);
  await page.getByRole('checkbox', { name: /đồng ý/i }).click();
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test('đăng ký → chọn Trung tâm "TT Ánh Dương" → không có Học phí; thêm Lớp tại nhà → có Học phí và ô Nơi dạy ở form ca', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await registerAndLogin(page);

  const setup = page.getByTestId('place-setup-dialog');
  await expect(setup.getByText('Bạn đang dạy ở đâu?')).toBeVisible();
  await setup.getByRole('checkbox', { name: /Trung tâm/ }).click();
  await setup.getByLabel('Tên trung tâm (không bắt buộc)').fill('TT Ánh Dương');
  await setup.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(setup.getByText('Chọn gói để bắt đầu')).toBeVisible();
  await expect(setup.getByTestId('plan-new-badge')).toHaveCount(0);
  await setup.getByRole('button', { name: 'Bắt đầu miễn phí' }).click();
  await expect(setup).toHaveCount(0);

  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('link', { name: 'Lịch dạy' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Học phí' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Báo cáo' })).toHaveCount(0);
  // Tải lại: popup không hiện lại vì đã có nơi.
  await page.reload();
  await expect(sidebar.getByRole('link', { name: 'Lịch dạy' })).toBeVisible();
  await expect(page.getByTestId('place-setup-dialog')).toHaveCount(0);

  await page.goto('/places');
  await expect(page.getByTestId('place-card')).toHaveText([/TT Ánh Dương/]);
  await page.getByRole('button', { name: 'Thêm nơi dạy' }).click();
  await page.getByLabel('Tên nơi dạy').fill('Lớp tại nhà');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByTestId('place-card')).toHaveCount(2);
  await expect(sidebar.getByRole('link', { name: 'Học phí' })).toBeVisible();

  // ≥ 2 nơi: form ca có ô Nơi dạy, chọn sẵn nơi theo học sinh.
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Nơi dạy' })).toContainText('Lớp tại nhà');
});

test('375px: bước chọn gói, nút "Bắt đầu miễn phí" luôn thấy ở đáy popup (FIX AL F1)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await registerAndLogin(page, `${USER}m`);
  const setup = page.getByTestId('place-setup-dialog');
  await setup.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(setup.getByText('Chọn gói để bắt đầu')).toBeVisible();
  const start = setup.getByRole('button', { name: 'Bắt đầu miễn phí' });
  await expect(start).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await start.click();
  await expect(setup).toHaveCount(0);
});
