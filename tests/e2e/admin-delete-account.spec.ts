import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const TARGET = 'e2e_q_del';
const PASSWORD = 'matkhau-e2e-q1';
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function cleanup() {
  const u = await db.user.findUnique({ where: { username: TARGET } });
  if (!u) return;
  await db.loginAttempt.deleteMany({ where: { OR: [{ userId: u.id }, { username: TARGET }] } });
  await db.classUpgradeLog.deleteMany({ where: { userId: u.id } });
  await db.planOrder.deleteMany({ where: { userId: u.id } });
  await db.student.deleteMany({ where: { userId: u.id } });
  await db.subject.deleteMany({ where: { userId: u.id } });
  await db.user.delete({ where: { id: u.id } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  await db.user.create({
    data: {
      username: TARGET,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      fullName: 'E2E Q Del',
    },
  });
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

async function login(page: Page, username: string, pass: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
}

test.describe('Admin xoá / khôi phục tài khoản (E2E)', () => {
  test('xoá mềm tài khoản: đá phiên, chặn đăng nhập, khôi phục từ tab Đã xoá, đăng nhập lại thành công', async ({
    browser,
  }) => {
    // 1. Context B đăng nhập e2e_q_del → vào /dashboard
    const teacher = await newPage(browser);
    await login(teacher, TARGET, PASSWORD);
    await expect(teacher).toHaveURL(/.*dashboard/);

    // 2. Context A (1280px) đăng nhập admin_test → /admin/accounts → hàng e2e_q_del → Xoá tài khoản
    const admin = await newPage(browser, DESKTOP);
    await login(admin, 'admin_test', 'teacher123');
    await expect(admin).toHaveURL(/\/admin\/overview$/);
    await admin.goto('/admin/accounts');

    const row = admin.getByRole('row').filter({ hasText: TARGET });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: `Menu hành động ${TARGET}` }).click();
    await admin.getByRole('menuitem', { name: 'Xoá tài khoản' }).click();

    const dlg = admin.getByRole('alertdialog');
    await expect(dlg).toContainText(`Xoá tài khoản ${TARGET}?`);
    await dlg.getByRole('button', { name: 'Xoá tài khoản' }).click();
    await expect(admin.getByText(`Đã xoá tài khoản ${TARGET}`)).toBeVisible();
    await expect(admin.getByRole('row').filter({ hasText: TARGET })).toHaveCount(0);
    expect(await admin.evaluate(() => document.body.style.pointerEvents)).not.toBe('none');

    // 3. B goto('/students') → URL /login có expired=1
    await teacher.goto('/students');
    await expect(teacher).toHaveURL(/\/login\?.*expired=1/);

    // B đăng nhập lại bằng đúng mật khẩu → vẫn ở /login, thấy câu lỗi đăng nhập chung
    await login(teacher, TARGET, PASSWORD);
    await expect(teacher).toHaveURL(/\/login/);
    await expect(teacher.getByRole('alert')).toBeVisible();

    // 4. A bấm tab "Đã xoá" → hàng e2e_q_del có người xoá admin_test → "Khôi phục"
    await admin.getByRole('tab', { name: /Đã xoá \(\d+\)/ }).click();
    const deletedRow = admin.getByRole('row').filter({ hasText: TARGET });
    await expect(deletedRow).toBeVisible();
    await expect(deletedRow).toContainText('admin_test');

    await deletedRow.getByRole('button', { name: 'Khôi phục' }).click();
    await expect(admin.getByText(`Đã khôi phục tài khoản ${TARGET}`)).toBeVisible();

    // Quay lại tab Đang dùng thấy lại
    await admin.getByRole('tab', { name: 'Đang dùng' }).click();
    await expect(admin.getByRole('row').filter({ hasText: TARGET })).toBeVisible();

    // 5. B đăng nhập lại → /dashboard
    await login(teacher, TARGET, PASSWORD);
    await expect(teacher).toHaveURL(/.*dashboard/);

    await teacher.context().close();
    await admin.context().close();
  });

  test('6. Mobile 390px: item Xoá tài khoản cao ≥44px, đóng bằng Escape, không xoá', async ({ browser }) => {
    const admin = await newPage(browser, MOBILE);
    await login(admin, 'admin_test', 'teacher123');
    await expect(admin).toHaveURL(/\/admin\/overview$/);
    await admin.goto('/admin/accounts');
    await expect(admin.getByRole('heading', { level: 1, name: 'Tài khoản & gói' })).toBeVisible();

    const card = admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' });
    await card.getByRole('button', { name: 'Menu hành động teacher_std' }).click();

    const menu = admin.getByRole('menu');
    await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

    const delItem = admin.getByRole('menuitem', { name: 'Xoá tài khoản' });
    const box = await delItem.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await admin.keyboard.press('Escape');
    await expect(admin.getByRole('menu')).toHaveCount(0);

    // teacher_std vẫn còn nguyên
    await expect(admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' })).toBeVisible();

    await admin.context().close();
  });
});
