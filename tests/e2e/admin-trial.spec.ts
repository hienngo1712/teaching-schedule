import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const DAY = 86_400_000;
const VN = 7 * 3_600_000;
// Chép logic vnStartOfDay / formatVnDate để e2e không import code src.
const vnStart = (d: Date) => new Date(Math.floor((d.getTime() + VN) / DAY) * DAY - VN);
const vnDate = (d: Date) => {
  const v = new Date(d.getTime() + VN);
  return `${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}/${v.getUTCFullYear()}`;
};

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
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/orders$/ : /.*dashboard/);
  return page;
}

// tests/setup.ts không xóa bảng này: dọn để mặc định về 60 cho file khác.
async function resetTrial() {
  await db.trialDayChange.deleteMany({ where: { changedBy: { not: 'migration' } } });
}
async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetTrial();
  await resetStd();
});

test.afterAll(async () => {
  await resetTrial();
  await resetStd();
  await db.$disconnect();
});

test('desktop: thẻ dùng thử mặc định 60 ngày; admin đặt 120 ngày cho teacher_std → hạn mới, giáo viên thấy Pro dùng thử', async ({ browser }) => {
  const std = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
  const end = new Date(vnStart(std.createdAt).getTime() + 120 * DAY);
  const lastDay = vnDate(new Date(end.getTime() - 1));
  const left = Math.round((vnStart(new Date(end.getTime() - 1)).getTime() - vnStart(new Date()).getTime()) / DAY) + 1;
  expect(left).toBeGreaterThan(0);

  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await admin.goto('/admin/prices');
  await expect(admin.getByTestId('trial-days-form').getByRole('textbox', { name: 'Số ngày dùng thử' })).toHaveValue('60');
  await expect(admin.getByRole('row').filter({ hasText: 'Ban đầu 60 ngày' })).toHaveCount(1);

  await admin.goto('/admin/accounts');
  await expect(admin.getByRole('row').filter({ hasText: 'admin_test' }).getByRole('button', { name: 'Đặt dùng thử' })).toHaveCount(0);
  await admin.getByRole('row').filter({ hasText: 'teacher_std' }).getByRole('button', { name: 'Đặt dùng thử' }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog).toContainText('Chưa có dùng thử');
  await dialog.getByRole('textbox', { name: 'Số ngày dùng thử (tính từ ngày tạo tài khoản)' }).fill('120');
  const preview = dialog.getByTestId('trial-preview');
  await expect(preview).toContainText(`Hạn dùng thử mới: dùng đến hết ngày ${lastDay}`);
  await expect(preview).toContainText(`Còn ${left} ngày dùng thử`);
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(admin.getByText('Đã đặt số ngày dùng thử')).toBeVisible();
  await expect(dialog).toBeHidden();
  expect((await db.user.findUniqueOrThrow({ where: { id: std.id } })).trialEndsAt?.toISOString()).toBe(end.toISOString());
  await admin.context().close();

  const teacher = await loginAs(browser, 'teacher_std', DESKTOP);
  await teacher.goto('/plan');
  const pro = teacher.getByTestId('plan-card-pro');
  await expect(pro).toContainText('Dùng thử');
  await expect(pro).toContainText(`Dùng đến hết ngày ${lastDay}`);
  await teacher.context().close();
});

test('390px: nút Đặt dùng thử ≥44px (không có ở thẻ admin), dialog không tràn ngang, nút Hủy/Lưu ≥44px', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test', MOBILE);
  await admin.goto('/admin/accounts');
  await expect(admin.getByTestId('admin-user-card').filter({ hasText: 'admin_test' }).getByRole('button', { name: 'Đặt dùng thử' })).toHaveCount(0);
  const btn = admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' }).getByRole('button', { name: 'Đặt dùng thử' });
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await btn.click();
  const dialog = admin.getByRole('dialog');
  // Dialog đang zoom-in thì boundingBox thấp hơn thật: chờ animation xong mới đo.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await dialog.getByRole('textbox', { name: 'Số ngày dùng thử (tính từ ngày tạo tài khoản)' }).fill('0');
  await expect(dialog.getByTestId('trial-preview')).toContainText('Không dùng thử');
  for (const name of ['Hủy', 'Lưu']) {
    expect((await dialog.getByRole('button', { name, exact: true }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
  }
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).toBeHidden();
  await admin.context().close();
});
