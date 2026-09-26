import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

test.use({ viewport: { width: 390, height: 844 } });

const db = new PrismaClient();

// 00:00 giờ VN của hôm nay + n ngày (cùng quy ước hạn của spec I D3).
function vnExpiry(daysFromToday: number): Date {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + daysFromToday) - 7 * 60 * 60 * 1000);
}

async function setStdPlus(daysLeft: number) {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'plus', planExpiresAt: vnExpiry(daysLeft), trialEndsAt: null } });
}

async function login(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher_std');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.beforeAll(() => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
});

test.afterAll(async () => {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
  await db.$disconnect();
});

test('Plus còn 45 ngày: popup giữa màn hình 1 lần/ngày; đóng xong nút Gia hạn ở header mở lại', async ({ page }) => {
  await setStdPlus(45);
  await login(page);

  const dialog = page.getByTestId('renew-offer');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Gói Plus còn 45 ngày');
  await expect(dialog).toContainText('Gia hạn 2 năm tặng 4 tháng, 1 năm tặng 2 tháng.');
  await expect(dialog).toContainText('ưu đãi giảm còn: 2 năm tặng 2 tháng, 1 năm tặng 1 tháng.');
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThan(844);

  await dialog.getByRole('button', { name: 'Để sau' }).click();
  await expect(dialog).toBeHidden();

  const renew = page.getByRole('banner').getByRole('button', { name: 'Gia hạn' });
  await expect(renew).toBeVisible();
  const renewBox = (await renew.boundingBox())!;
  expect(renewBox.height).toBeGreaterThanOrEqual(44);
  expect(renewBox.width).toBeGreaterThanOrEqual(44);

  // Cùng ngày VN: tải lại / chuyển màn không tự hiện lại.
  await page.reload();
  await expect(renew).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.goto('/students');
  await expect(renew).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await renew.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Gia hạn ngay' }).click();
  await expect(page).toHaveURL(/\/plan/);
  await expect(dialog).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Plus còn 10 ngày: ưu đãi 2 năm +2, 1 năm +1, nhắc hết hạn là mất ưu đãi', async ({ page }) => {
  await setStdPlus(10);
  await login(page);
  const dialog = page.getByTestId('renew-offer');
  await expect(dialog).toContainText('Gia hạn 2 năm tặng 2 tháng, 1 năm tặng 1 tháng.');
  await expect(dialog).toContainText('Hết hạn rồi mới gia hạn sẽ không còn ưu đãi.');
});

test('localStorage bị chặn: popup vẫn hiện, trang không lỗi', async ({ page }) => {
  await setStdPlus(45);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  await login(page);
  await expect(page.getByTestId('renew-offer')).toBeVisible();
});

test('Plus còn 61 ngày: không popup, không nút Gia hạn', async ({ page }) => {
  await setStdPlus(61);
  const planLoaded = page.waitForResponse((r) => r.url().includes('plan.me'));
  await login(page);
  await planLoaded;
  await expect(page.getByTestId('renew-offer')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Gia hạn' })).toHaveCount(0);
});
