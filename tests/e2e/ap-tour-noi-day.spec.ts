import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { RELEASES } from '../../src/lib/releases';

// Spec AP §6: tour "Chỉ cho tôi" cho Nơi dạy (place) và Thu nhập (income).
test.describe.configure({ mode: 'serial' });

const db = new PrismaClient();
const PRO = 'tour_ap_pro';
const STD = 'tour_ap_std';

async function cleanup() {
  for (const username of [PRO, STD]) {
    await db.loginAttempt.deleteMany({ where: { username } });
    // Nơi dạy, đơn giá xoá theo user (onDelete Cascade).
    await db.user.deleteMany({ where: { username } });
  }
}

const homePlace = { name: 'Lớp tại nhà', kind: 'home', color: '#4F46E5', billingChanges: { create: { fromKey: 0, billing: 'per_student' } } };
const centerPlace = {
  name: 'TT Tour AP',
  kind: 'center',
  color: '#0891B2',
  billingChanges: { create: { fromKey: 0, billing: 'per_session' } },
  rateChanges: { create: { fromKey: 0, unit: 'session', amount: 150000 } },
};

async function createUser(username: string, plan: 'pro' | 'standard', withCenter: boolean) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  await db.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash('teacher123', 4),
      fullName: 'Cô Tour AP',
      plan,
      planExpiresAt: plan === 'pro' ? expires : null,
      lastSeenRelease: RELEASES[0].version,
      feedbackPromptAt: new Date(),
      onboardingDismissedAt: new Date(),
      mustChangePassword: false,
      // Đã có nơi dạy: không hiện popup chọn nơi che tour.
      places: { create: withCenter ? [homePlace, centerPlace] : [homePlace] },
    },
  });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  await createUser(PRO, 'pro', false);
  await createUser(STD, 'standard', true);
});

test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

const popover = (page: Page) => page.locator('.driver-popover');
const next = (page: Page) => popover(page).locator('.driver-popover-next-btn');

async function noOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}px: tour Nơi dạy chạy hết 6 bước trong hộp, nút Tiếp không bị che`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: vp });
    await login(page, PRO);
    await page.goto('/places?tour=place');
    await expect(popover(page)).toContainText('1/6 · Thêm nơi dạy');
    await page.locator('[data-tour="place-add"]:visible').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toContainText('2/6 · Tên nơi dạy');
    await next(page).click();
    await expect(popover(page)).toContainText('3/6 · Loại nơi');
    await next(page).click();
    await expect(popover(page)).toContainText('4/6 · Cách tính tiền');
    // Làm theo lời chỉ: chọn Theo ca/giờ thì có ô Đơn giá cho bước 5.
    await dialog.getByRole('radio', { name: 'Theo ca/giờ, nơi này trả' }).click();
    await expect(popover(page)).toContainText('4/6 · Cách tính tiền');
    await next(page).click();
    await expect(popover(page)).toContainText('5/6 · Đơn giá');
    await expect(next(page)).toBeInViewport();
    await next(page).click();
    await expect(popover(page)).toContainText('6/6 · Lưu nơi dạy');
    await expect(next(page)).toBeInViewport();
    await expect(next(page)).toHaveText('Xong');
    await noOverflow(page, vp.width);
    await next(page).click();
    await expect(page.locator('.driver-overlay')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.close();
  });
}

test('Theo học sinh (mặc định): bước Đơn giá không có thì bỏ qua ngay sang Lưu', async ({ page }) => {
  await login(page, PRO);
  await page.goto('/places?tour=place');
  await expect(popover(page)).toContainText('1/6 · Thêm nơi dạy');
  await page.locator('[data-tour="place-add"]:visible').click();
  await expect(popover(page)).toContainText('2/6 · Tên nơi dạy');
  await next(page).click();
  await expect(popover(page)).toContainText('3/6 · Loại nơi');
  await next(page).click();
  await expect(popover(page)).toContainText('4/6 · Cách tính tiền');
  await next(page).click();
  await expect(popover(page)).toContainText('6/6 · Lưu nơi dạy', { timeout: 1500 });
});

test('[RF 2] Thu nhập khi chỉ có nơi theo học sinh: bước báo thiếu → chuyển sang tour Nơi dạy', async ({ page }) => {
  await login(page, PRO);
  await page.goto('/timesheet?tab=income&tour=income');
  await expect(popover(page)).toContainText('Chưa có nơi dạy theo ca/giờ');
  await popover(page).getByRole('button', { name: 'Chỉ cách thêm nơi dạy' }).click();
  await expect(page).toHaveURL(/\/places$/);
  await expect(popover(page)).toContainText('1/6 · Thêm nơi dạy');
  await expect(page.locator('[data-tour="place-add"]:visible')).toBeVisible();
});

for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  test(`[RF 3][RF 4] ${vp.width}px: tour Thu nhập (gói Standard) chạy hết, mở chi tiết, không bật hộp nâng gói`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: vp });
    await login(page, STD);
    // Đi từ /guide như người dùng: nút Chỉ cho tôi của mục Bảng công.
    await page.goto('/timesheet?tab=income&tour=income');
    await expect(page).toHaveURL(/\/timesheet\?tab=income$/);
    await expect(popover(page)).toContainText('1/5 · Chọn tháng');
    await next(page).click();
    await expect(popover(page)).toContainText('2/5 · Thu nhập từng nơi');
    await next(page).click();
    await expect(popover(page)).toContainText('3/5 · Phiếu báo');
    await expect(popover(page)).toContainText('gói Plus');
    await next(page).click();
    await expect(popover(page)).toContainText('4/5 · Xem chi tiết');
    await page.locator('[data-tour="income-row"]:visible').click();
    await expect(page.getByTestId('income-detail')).toBeVisible();
    await expect(popover(page)).toContainText('5/5 · Ghi nhận đã nhận');
    await expect(popover(page)).toContainText('gói Plus');
    await expect(next(page)).toBeInViewport();
    await expect(page.getByTestId('upgrade-dialog')).toHaveCount(0);
    await noOverflow(page, vp.width);
    await next(page).click();
    await expect(page.locator('.driver-overlay')).toHaveCount(0);
    await expect(page.getByTestId('upgrade-dialog')).toHaveCount(0);
    await page.close();
  });
}
