import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();

async function hideDevBadge(page: Page) {
  // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
}

async function login(page: Page, username: string) {
  await hideDevBadge(page);
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  // Ghi thẳng DB: phải chắc đang trỏ DB test, không phải production.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
});

test.afterAll(async () => {
  await resetStd();
  await db.$disconnect();
});

test.describe('Gói của tôi (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Standard: vào từ sheet Thêm, thẻ Pro đứng đầu, Pro + Năm chọn sẵn, tạo mã Plus năm rồi hủy', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Thêm' }).getByRole('link', { name: /Gói của tôi/ }).click();
    await expect(page).toHaveURL(/\/plan/);

    const current = page.getByTestId('current-plan');
    await expect(current).toContainText('Standard');
    await expect(current).toContainText('Miễn phí');
    await expect(current).toContainText(/Học sinh đang học: \d+\/10/);

    // Mobile: Pro → Plus → Standard từ trên xuống.
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
    expect(await y('plan-card-pro')).toBeLessThan(await y('plan-card-plus'));
    expect(await y('plan-card-plus')).toBeLessThan(await y('plan-card-standard'));
    await expect(page.getByTestId('plan-card-pro')).toContainText('Khuyên dùng');
    await expect(page.getByTestId('plan-card-standard')).toContainText('Đang dùng');
    await expect(page.getByTestId('plan-card-plus')).toContainText('Mọi thứ của gói Standard, thêm:');
    await expect(page.getByTestId('plan-card-pro')).toContainText('Không giới hạn học sinh');

    const checkout = page.getByTestId('plan-checkout');
    await expect(checkout.getByRole('button', { name: 'Pro', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(checkout.getByRole('button', { name: 'Năm', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(checkout).toContainText('990.000');

    await checkout.getByRole('button', { name: 'Plus', exact: true }).click();
    await expect(checkout).toContainText('490.000');
    await checkout.getByRole('button', { name: '2 năm', exact: true }).click();
    await expect(checkout).toContainText('980.000');
    await expect(checkout).toContainText('Tặng 2 tháng');
    await checkout.getByRole('button', { name: 'Năm', exact: true }).click();

    for (const b of await checkout.getByRole('button').all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    await checkout.getByRole('button', { name: 'Tạo mã chuyển khoản' }).click();
    const pending = page.getByTestId('pending-order');
    await expect(pending).toBeVisible();
    await expect(pending).toContainText('Chờ xác nhận');
    await expect(pending).toContainText(/SM [ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}/);
    await expect(pending).toContainText('490.000');
    await expect(pending.getByRole('img', { name: 'VietQR' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await pending.getByRole('button', { name: 'Hủy yêu cầu' }).click();
    await expect(pending).toBeHidden();
    await expect(page.getByTestId('plan-history')).toContainText('Đã hủy');
  });
});

test.describe('Gói của tôi (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('desktop: Standard bên trái, Pro bên phải; bấm CTA thẻ Plus thì checkout chọn Plus', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.goto('/plan');
    const x = async (id: string) => (await page.getByTestId(id).boundingBox())!.x;
    expect(await x('plan-card-standard')).toBeLessThan(await x('plan-card-plus'));
    expect(await x('plan-card-plus')).toBeLessThan(await x('plan-card-pro'));
    await page.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
    await expect(page.getByTestId('plan-checkout').getByRole('button', { name: 'Plus', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
