import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const T = (s: string) => new Date(`1970-01-01T${s}:00.000Z`);
const RANGE = { gte: D('2030-01-01'), lt: D('2031-01-01') };
let teacherId = 0;
let subjectId = 0;
let stdId = 0;

async function mk(date: string, start: string, end: string, extra: { title: string; status?: string; makeupOfId?: number }) {
  return db.teachingSession.create({
    data: { userId: teacherId, subjectId, sessionDate: D(date), startTime: T(start), endTime: T(end), ...extra },
  });
}

async function login(page: Page, username: string) {
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
  await expect(page).toHaveURL(/.*dashboard/);
}

const boxOf = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!;
const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  teacherId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher' } })).id;
  stdId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  subjectId = (await db.subject.findFirstOrThrow({ where: { userId: teacherId } })).id;
  await db.teachingSession.deleteMany({ where: { userId: teacherId, sessionDate: RANGE } });

  for (const d of ['07', '14', '21', '28']) await mk(`2030-01-${d}`, '17:00', '18:30', { title: 'E2E Chép T2' });
  for (const d of ['02', '09', '23', '30']) await mk(`2030-01-${d}`, '08:00', '09:30', { title: 'E2E Chép T4' });
  const cancelled = await mk('2030-01-16', '08:00', '09:30', { title: 'E2E Chép T4', status: 'cancelled' });
  await mk('2030-01-18', '08:00', '09:30', { title: 'E2E Bù T6', makeupOfId: cancelled.id });
  for (const d of ['03', '10', '17', '24', '31']) await mk(`2030-01-${d}`, '19:00', '20:30', { title: 'E2E Chép T5' });
  await mk('2030-01-26', '10:00', '11:00', { title: 'E2E Lẻ T7' });
});

test.afterAll(async () => {
  await db.teachingSession.deleteMany({ where: { userId: teacherId, sessionDate: RANGE } });
  await db.user.update({ where: { id: stdId }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
  await db.$disconnect();
});

test('desktop: xem trước theo lịch gốc, tạo 3 tháng, chạy lại không trùng', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, 'teacher');
  await page.goto('/calendar?year=2030&month=1');

  await page.getByTestId('copy-month-button').click();
  const dlg = page.getByTestId('copy-month-dialog');
  await expect(dlg.getByTestId('copy-source')).toContainText('Tháng 1 / 2030');
  await expect(dlg.getByTestId('copy-from')).toContainText('Tháng 2 / 2030');

  const patterns = dlg.getByTestId('copy-pattern');
  await expect(patterns).toHaveCount(4);
  await expect(patterns.filter({ hasText: 'E2E Lẻ T7' })).toHaveAttribute('data-selected', 'false');
  await expect(patterns.filter({ hasText: 'E2E Chép T4' })).toHaveAttribute('data-selected', 'true');
  await expect(dlg.getByText('E2E Bù T6')).toHaveCount(0);
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 12 ca');

  await dlg.getByTestId('copy-months-3').click();
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 37 ca');
  await expect(dlg.getByTestId('copy-confirm')).toBeEnabled();
  await dlg.getByTestId('copy-confirm').click();
  await expect(dlg.getByTestId('copy-result')).toContainText('Đã tạo 37 ca');

  await dlg.getByRole('button', { name: 'Xem Tháng 2 / 2030' }).click();
  await expect(page).toHaveURL(/year=2030&month=2/);
  await expect(page.getByTestId('copy-month-dialog')).toHaveCount(0);
  // Thứ của ca gốc (kể cả thứ có ca đã huỷ) có đủ ca; thứ của ca bù không có.
  await expect(page.getByText('E2E Chép T2').filter({ visible: true })).toHaveCount(4);
  await expect(page.getByText('E2E Chép T4').filter({ visible: true })).toHaveCount(4);
  await expect(page.getByText('E2E Bù T6').filter({ visible: true })).toHaveCount(0);
  expect(await db.teachingSession.count({ where: { userId: teacherId, sessionDate: { gte: D('2030-02-01'), lt: D('2030-05-01') } } })).toBe(37);

  // Chạy lại từ tháng 1: mọi ca tháng 2 đã có → 0 ca, nút Tạo khóa.
  await page.goto('/calendar?year=2030&month=1');
  await page.getByTestId('copy-month-button').click();
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 0 ca');
  await expect(dlg.getByText('12 ca đã có, bỏ qua')).toBeVisible();
  await expect(dlg.getByTestId('copy-confirm')).toBeDisabled();
});

test('mobile 390px: nút toolbar ≥44px không chồng nhau, dialog toàn màn hình không tràn, tạo được', async ({ page }) => {
  await db.teachingSession.deleteMany({ where: { userId: teacherId, sessionDate: { gte: D('2030-02-01'), lt: D('2031-01-01') } } });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'teacher');
  await page.goto('/calendar?year=2030&month=1');

  const copyBtn = await boxOf(page, 'copy-month-button');
  const bulkBtn = (await page.getByRole('button', { name: 'Lịch lặp' }).boundingBox())!;
  const createBtn = (await page.getByRole('button', { name: 'Tạo ca dạy' }).filter({ visible: true }).first().boundingBox())!;
  for (const b of [copyBtn, bulkBtn, createBtn]) expect(b.height).toBeGreaterThanOrEqual(44);
  expect(intersects(copyBtn, bulkBtn)).toBe(false);
  expect(intersects(copyBtn, createBtn)).toBe(false);
  expect(intersects(bulkBtn, createBtn)).toBe(false);

  await page.getByTestId('copy-month-button').click();
  const dlg = page.getByTestId('copy-month-dialog');
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 12 ca');
  // Đo khi dialog còn hiệu ứng mở thì kích thước chưa đúng → chờ animation xong.
  await dlg.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const dlgBox = (await dlg.boundingBox())!;
  expect(dlgBox.width).toBeGreaterThanOrEqual(389);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await dlg.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  const targets = dlg.locator('button:visible:not([role="checkbox"]), [data-testid="copy-pattern"] label');
  const n = await targets.count();
  for (let i = 0; i < n; i++) {
    const b = (await targets.nth(i).boundingBox())!;
    expect(b.height, `phần tử bấm thứ ${i} trong dialog`).toBeGreaterThanOrEqual(44);
  }

  await expect(dlg.getByTestId('copy-confirm')).toBeInViewport();
  await dlg.getByTestId('copy-confirm').click();
  await expect(dlg.getByTestId('copy-result')).toContainText('Đã tạo 12 ca');
});

test('Standard: nút có khóa, bấm mở popup nâng cấp, không gọi xem trước; /plan thẻ Plus có dòng mới', async ({ page }) => {
  await db.user.update({ where: { id: stdId }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
  const previewCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('session.copyMonthPreview')) previewCalls.push(r.url());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, 'teacher_std');
  await page.goto('/calendar');

  const btn = page.getByTestId('copy-month-button');
  await expect(btn.getByTestId('lock-badge')).toBeVisible();
  await btn.click();
  await expect(page.getByTestId('upgrade-dialog')).toContainText('Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.');
  await expect(page.getByTestId('copy-month-dialog')).toHaveCount(0);
  expect(previewCalls).toEqual([]);

  await page.goto('/plan');
  await expect(page.getByTestId('plan-card-plus')).toContainText('Chép lịch sang tháng sau (tối đa 3 tháng)');
});
