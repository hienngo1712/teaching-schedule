import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const TARGET = 'reset_e2e';
const NEW_PASSWORD = 'MoiSauReset@2026';
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function cleanup() {
  const u = await db.user.findUnique({ where: { username: TARGET } });
  if (!u) return;
  // auth.me tự chạy lên lớp và ghi class_upgrade_logs (FK tới users).
  await db.classUpgradeLog.deleteMany({ where: { userId: u.id } });
  await db.passwordResetLog.deleteMany({ where: { userId: u.id } });
  await db.loginAttempt.deleteMany({ where: { username: TARGET } });
  await db.user.delete({ where: { id: u.id } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  await db.user.create({ data: { username: TARGET, passwordHash: await bcrypt.hash('teacher123', 4), fullName: 'Reset E2E' } });
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function newPage(browser: Browser, viewport = DESKTOP): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  return page;
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

test('admin reset → mật khẩu tạm hiện 1 lần → phiên cũ bị đá → đăng nhập bằng mật khẩu tạm bị bắt đổi → đổi xong vào dashboard', async ({ browser }) => {
  // Máy của giáo viên đang đăng nhập bằng mật khẩu cũ.
  const teacher = await newPage(browser);
  await login(teacher, TARGET, 'teacher123');
  await expect(teacher).toHaveURL(/.*dashboard/);

  const admin = await newPage(browser);
  await login(admin, 'admin_test', 'teacher123');
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.goto('/admin/accounts');
  const row = admin.getByRole('row').filter({ hasText: TARGET });
  await row.getByRole('button', { name: 'Reset mật khẩu' }).click();
  const dlg = admin.getByRole('alertdialog');
  await expect(dlg).toContainText(TARGET);
  await dlg.getByRole('button', { name: 'Reset mật khẩu' }).click();
  const tempBox = dlg.getByTestId('temp-password');
  await expect(tempBox).toHaveText(/^Lich-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  const temp = (await tempBox.textContent())!.trim();
  await dlg.getByRole('button', { name: 'Tôi đã lưu mật khẩu' }).click();
  await expect(admin.getByRole('alertdialog')).toHaveCount(0);
  // Mở lại dialog chỉ thấy bước xác nhận, không còn mật khẩu cũ.
  await row.getByRole('button', { name: 'Reset mật khẩu' }).click();
  await expect(admin.getByRole('alertdialog')).toBeVisible();
  await expect(admin.getByTestId('temp-password')).toHaveCount(0);
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Hủy' }).click();

  await teacher.goto('/students');
  await expect(teacher).toHaveURL(/\/login\?.*expired=1/);

  await login(teacher, TARGET, temp);
  await expect(teacher).toHaveURL(/\/change-password$/);
  await teacher.goto('/students');
  await expect(teacher).toHaveURL(/\/change-password$/);

  await teacher.locator('#current-pw').fill(temp);
  await teacher.locator('#new-pw').fill(temp);
  await teacher.locator('#confirm-pw').fill(temp);
  await teacher.locator('button[type="submit"]').click();
  // Trang đầy đủ có thêm __next-route-announcer__ (cũng role=alert) nên lọc theo chữ.
  await expect(teacher.getByRole('alert').filter({ hasText: 'Mật khẩu mới phải khác mật khẩu hiện tại' })).toBeVisible();

  await teacher.locator('#new-pw').fill(NEW_PASSWORD);
  await teacher.locator('#confirm-pw').fill(NEW_PASSWORD);
  await teacher.locator('button[type="submit"]').click();
  await expect(teacher).toHaveURL(/.*dashboard/);
  await teacher.goto('/students');
  await expect(teacher).toHaveURL(/\/students$/);
  await teacher.context().close();
  await admin.context().close();
});

test('390px: thẻ tài khoản có nút Reset mật khẩu cao ≥44px, hàng nút và dialog không tràn, tài khoản admin không có nút', async ({ browser }) => {
  const admin = await newPage(browser, MOBILE);
  await login(admin, 'admin_test', 'teacher123');
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.goto('/admin/accounts');
  const card = admin.getByTestId('admin-user-card').filter({ hasText: TARGET });
  const btn = card.getByRole('button', { name: 'Reset mật khẩu' });
  const box = (await btn.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  const adminCard = admin.getByTestId('admin-user-card').filter({ hasText: 'admin_test' });
  await expect(adminCard.getByRole('button', { name: 'Reset mật khẩu' })).toHaveCount(0);

  await btn.click();
  const dlg = admin.getByRole('alertdialog');
  // Dialog đang zoom-in thì boundingBox thấp hơn thật: chờ animation xong mới đo.
  await dlg.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  for (const name of ['Hủy', 'Reset mật khẩu']) {
    expect((await dlg.getByRole('button', { name, exact: true }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
  }
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dlg).toBeHidden();
  await admin.context().close();
});
