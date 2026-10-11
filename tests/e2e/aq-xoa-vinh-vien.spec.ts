import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// Spec AQ §6/§8: admin xoá vĩnh viễn TK đã xoá ≥ 30 ngày ở tab Đã xoá; dòng mất, số tab giảm, đơn mua gói còn.
test.describe.configure({ mode: 'serial' });

const db = new PrismaClient();
const SHOTS = '../student-managerment/.superpowers/mockups/aj/that-aq';
const NEW = 'aq_e2e_moi';
const DAY = 86_400_000;
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 900 },
];
const target = (w: number) => `aq_e2e_${w}`;

async function cleanup() {
  const users = await db.user.findMany({
    where: { OR: [{ username: { in: [NEW, ...VIEWPORTS.map((v) => target(v.width))] } }, { username: { startsWith: 'deleted_' } }] },
    select: { id: true, username: true },
  });
  for (const u of users) {
    await db.loginAttempt.deleteMany({ where: { OR: [{ userId: u.id }, { username: u.username }] } });
    await db.planOrder.deleteMany({ where: { userId: u.id } });
    await db.student.deleteMany({ where: { userId: u.id } });
    await db.subject.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }
  await db.securityEvent.deleteMany({ where: { event: 'admin_purge_user' } });
}

async function seedDeleted(username: string, daysAgo: number) {
  const u = await db.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash('matkhau-aq-e2e', 4),
      fullName: 'GV AQ E2E',
      isDeleted: true,
      deletedAt: new Date(Date.now() - daysAgo * DAY),
      deletedBy: 'admin_test',
    },
  });
  await db.student.create({ data: { userId: u.id, fullName: 'HS AQ E2E', grade: 5 } });
  await db.planOrder.create({ data: { userId: u.id, plan: 'plus', period: '1m', amount: 59000, status: 'approved', decidedAt: new Date() } });
  return u;
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  await seedDeleted(NEW, 1);
  for (const v of VIEWPORTS) await seedDeleted(target(v.width), 31);
});

test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function adminPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await page.goto('/admin/accounts');
  return page;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const vp of VIEWPORTS) {
  test(`${vp.width}px: tab Đã xoá → Xoá vĩnh viễn TK đủ 30 ngày (gõ đúng tên) → dòng mất, số tab giảm, đơn còn`, async ({ browser }) => {
    const name = target(vp.width);
    const before = await db.planOrder.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: true });
    const page = await adminPage(browser, vp);
    const tab = page.getByRole('tab', { name: /Đã xoá \((\d+)\)/ });
    await tab.click();

    // 375: thẻ; 1280: dòng bảng.
    const item = (u: string) =>
      vp.width < 768 ? page.getByTestId('admin-deleted-user-card').filter({ hasText: u }) : page.getByRole('row').filter({ hasText: u });
    await expect(item(NEW)).toContainText('Xoá vĩnh viễn được từ');
    // Đọc số sau khi danh sách đã tải (lúc đang tải tab ghi 0).
    const count = Number((await tab.textContent())!.match(/\((\d+)\)/)![1]);
    await expect(item(NEW).getByTestId('admin-purge-user')).toHaveCount(0);
    await expect(item(name).getByTestId('admin-purge-user')).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/tab-da-xoa-${vp.width}.png` });

    await item(name).getByTestId('admin-purge-user').click();
    const dlg = page.getByRole('alertdialog');
    await expect(dlg).toContainText(`Xoá vĩnh viễn ${name}?`);
    const confirm = dlg.getByRole('button', { name: 'Xoá vĩnh viễn' });
    await expect(confirm).toBeDisabled();
    await dlg.getByLabel(`Gõ ${name} để xác nhận`).fill(`${name} `);
    await expect(confirm).toBeDisabled();
    await dlg.getByLabel(`Gõ ${name} để xác nhận`).fill(name);
    await expect(confirm).toBeEnabled();
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/hop-xac-nhan-${vp.width}.png` });
    await confirm.click();

    await expect(page.getByText('Đã xoá vĩnh viễn')).toBeVisible();
    await expect(dlg).toHaveCount(0);
    await expect(item(name)).toHaveCount(0);
    await expect(page.getByRole('tab', { name: new RegExp(`Đã xoá \\(${count - 1}\\)`) })).toBeVisible();

    const after = await db.planOrder.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: true });
    expect(after).toEqual(before);
    const u = await db.user.findFirstOrThrow({ where: { username: { startsWith: 'deleted_' }, planOrders: { some: {} } }, orderBy: { purgedAt: 'desc' } });
    expect(u.purgedAt).not.toBeNull();
    expect(await db.student.count({ where: { userId: u.id } })).toBe(0);
    await page.close();
  });
}
