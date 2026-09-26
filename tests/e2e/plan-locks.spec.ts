import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

test.use({ viewport: { width: 390, height: 844 } });

const db = new PrismaClient();
const NAME = `E2E Khóa gói ${Math.floor(Math.random() * 100000)}`;
const FAR = new Date('2099-12-31T17:00:00.000Z');
let stdId = 0;

async function setStd(plan: 'standard' | 'plus') {
  await db.user.update({ where: { id: stdId }, data: { plan, planExpiresAt: plan === 'standard' ? null : FAR, trialEndsAt: null } });
}

// P12: duyệt app bằng gói thấp không được nhận response FORBIDDEN nào (query bị khóa không gọi).
function trackForbidden(page: Page): string[] {
  const hits: string[] = [];
  page.on('response', async (r) => {
    if (!r.url().includes('/api/trpc/')) return;
    const body = await r.text().catch(() => '');
    if (body.includes('"FORBIDDEN"')) hits.push(r.url());
  });
  return hits;
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

const upgrade = (page: Page) => page.getByTestId('upgrade-dialog');
const PLUS_TEXT = 'Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.';
const PRO_TEXT = 'Nâng lên gói Pro để sử dụng tính năng này.';

async function closeUpgrade(page: Page) {
  await upgrade(page).getByRole('button', { name: 'Để sau' }).click();
  await expect(upgrade(page)).toBeHidden();
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  stdId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  await db.planOrder.deleteMany({ where: { userId: stdId } });
  await db.student.deleteMany({ where: { userId: stdId } });
  await setStd('standard');
  await db.student.create({ data: { userId: stdId, fullName: NAME, grade: 5, tuitionFee: 100000 } });
});

test.afterAll(async () => {
  await db.monthlyTuition.deleteMany({ where: { student: { userId: stdId } } });
  await db.student.deleteMany({ where: { userId: stdId } });
  await setStd('standard');
  await db.$disconnect();
});

test('Standard: đủ menu như Pro; Báo cáo, Cần chú ý, Ghi nhận, sheet học phí, nhập Excel, link phụ huynh đều có khóa và mở popup đúng gói', async ({ page }) => {
  const forbidden = trackForbidden(page);
  await login(page);

  // Cần chú ý ở Tổng quan: khung mờ + khóa Pro.
  await page.getByTestId('alerts-locked').click();
  await expect(upgrade(page)).toContainText(PRO_TEXT);
  await closeUpgrade(page);

  // Báo cáo trong sheet Thêm: vẫn hiện, bấm mở popup Plus, không điều hướng.
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Thêm' });
  await expect(sheet.getByRole('button', { name: /Báo cáo/ })).toContainText('Plus');
  await expect(sheet.getByRole('link', { name: /Môn học/ })).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Gói của tôi/ })).toBeVisible();
  await sheet.getByRole('button', { name: /Báo cáo/ }).click();
  await expect(upgrade(page)).toContainText(PLUS_TEXT);
  await expect(page).toHaveURL(/dashboard/);
  await closeUpgrade(page);

  // Học phí: nút Ghi nhận có khóa → popup Plus; bấm thẻ vẫn mở sheet xem tiền, lịch sử thu khóa.
  await page.goto('/tuition');
  const card = page.getByRole('button', { name: new RegExp(NAME) }).filter({ has: page.locator('text=' + NAME) }).first();
  await expect(card).toBeVisible();
  const pay = card.getByRole('button', { name: /Ghi nhận/ });
  await expect(pay.getByTestId('lock-badge')).toBeVisible();
  await pay.click();
  await expect(upgrade(page)).toContainText(PLUS_TEXT);
  await closeUpgrade(page);
  await card.click();
  const detail = page.getByRole('dialog').filter({ hasText: 'Chi tiết học phí' });
  await expect(detail.getByText('Tổng tiền cần đóng')).toBeVisible();
  await expect(detail.getByTestId('payments-locked')).toBeVisible();
  await detail.getByRole('button', { name: /Phiếu báo/ }).click();
  await expect(upgrade(page)).toContainText(PLUS_TEXT);
  await closeUpgrade(page);
  await page.keyboard.press('Escape');

  // Học sinh: nhập Excel khóa Pro; menu Link phụ huynh khóa Pro.
  await page.goto('/students');
  const importBtn = page.getByRole('button', { name: 'Nhập Excel' });
  await expect(importBtn.getByTestId('lock-badge')).toBeVisible();
  await importBtn.click();
  await expect(upgrade(page)).toContainText(PRO_TEXT);
  await closeUpgrade(page);
  const studentCard = page.locator('div.rounded-lg.border', { hasText: NAME }).filter({ visible: true }).first();
  await studentCard.getByRole('button', { name: 'Menu hành động' }).click();
  await page.getByRole('menuitem', { name: /Link phụ huynh/ }).click();
  await expect(upgrade(page)).toContainText(PRO_TEXT);
  await closeUpgrade(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(forbidden).toEqual([]);
});

test('Standard vào thẳng /reports: khung báo cáo mờ + popup Plus', async ({ page }) => {
  const forbidden = trackForbidden(page);
  await login(page);
  await page.goto('/reports');
  await expect(page.getByTestId('reports-locked')).toBeVisible();
  await expect(upgrade(page)).toContainText(PLUS_TEXT);
  expect(forbidden).toEqual([]);
});

test('Plus mở /reports?type=year&grade=5: báo cáo 1 tháng, Năm/Khoảng và ô lớp có khóa Pro', async ({ page }) => {
  await setStd('plus');
  const forbidden = trackForbidden(page);
  await login(page);
  await page.goto('/reports?type=year&grade=5');
  await expect(page.getByTestId('reports-locked')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  // 390px: ô lọc lớp nằm trong sheet "Lọc" của FilterBar.
  await page.getByRole('button', { name: /^Lọc/ }).click();
  const gradeBtn = page.getByRole('dialog').getByRole('button', { name: /Tất cả lớp/ });
  await gradeBtn.click();
  await expect(upgrade(page)).toContainText(PRO_TEXT);
  await closeUpgrade(page);
  await expect(page.getByTestId('stat-card').first()).toBeVisible();
  expect(forbidden).toEqual([]);
  await setStd('standard');
});

test('Standard đủ 10 HS đang học: dải giới hạn + nút Thêm học sinh mở popup giới hạn', async ({ page }) => {
  await db.student.createMany({
    data: Array.from({ length: 9 }, (_, i) => ({ userId: stdId, fullName: `${NAME} thêm ${i + 1}`, grade: 4 })),
  });
  await login(page);
  await page.goto('/students');
  await expect(page.getByTestId('plan-limit-strip')).toContainText('10/10 học sinh đang học');
  await page.getByRole('button', { name: /Thêm học sinh/ }).click();
  await expect(upgrade(page)).toContainText('Gói Standard tối đa 10 học sinh đang học. Nâng lên Plus (40) hoặc Pro (không giới hạn).');
  await db.student.deleteMany({ where: { userId: stdId, fullName: { startsWith: `${NAME} thêm` } } });
});
