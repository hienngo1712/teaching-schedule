import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// Spec AM §6: nơi Trung tâm theo giờ 185.000 → 2 ca 1,5 giờ đã qua → Bảng công 2 ca 3 giờ → Thu nhập 555.000
// → ghi nhận 500.000 → "Nhận một phần, còn thiếu 55.000".
const db = new PrismaClient();
const PLACE = `TT E2E Bảng công ${Date.now().toString().slice(-5)}`;

async function cleanup() {
  const places = await db.teachingPlace.findMany({ where: { name: { startsWith: 'TT E2E Bảng công' } }, select: { id: true } });
  const ids = places.map((p) => p.id);
  if (ids.length === 0) return;
  await db.teachingSession.deleteMany({ where: { placeId: { in: ids } } });
  await db.teachingPlace.deleteMany({ where: { id: { in: ids } } });
}

async function trpc<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).result.data as T;
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test('Bảng công 2 ca 3 giờ → Thu nhập 555.000 → nhận 500.000 → Nhận một phần, còn thiếu 55.000', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  const place = await trpc<{ id: number }>(page, 'place.create', { name: PLACE, kind: 'center', color: '#0891B2', billing: 'per_session' });
  const vn = new Date(Date.now() + 7 * 3600_000);
  await trpc(page, 'placeRate.set', { placeId: place.id, unit: 'hour', amount: 185000, fromYear: vn.getUTCFullYear(), fromMonth: vn.getUTCMonth() + 1 });
  // Tháng trước: 2 ca chắc chắn đã qua.
  const py = vn.getUTCMonth() === 0 ? vn.getUTCFullYear() - 1 : vn.getUTCFullYear();
  const pm = vn.getUTCMonth() === 0 ? 12 : vn.getUTCMonth();
  const mm = String(pm).padStart(2, '0');
  const subjects = await (await page.request.get(`/api/trpc/subject.list?input=${encodeURIComponent(JSON.stringify({ isActive: true }))}`)).json();
  const subjectId = subjects.result.data[0].id;
  for (const d of ['10', '12']) {
    await trpc(page, 'session.create', { sessionDate: `${py}-${mm}-${d}`, startTime: '08:00', endTime: '09:30', subjectId, placeId: place.id });
  }

  await page.goto(`/timesheet?year=${py}&month=${pm}`);
  await page.getByRole('combobox', { name: 'Nơi dạy' }).click();
  await page.getByRole('option', { name: PLACE }).click();
  const done = page.getByTestId('stat-card').filter({ hasText: 'Đã dạy' });
  await expect(done).toContainText('2 ca');
  await expect(done).toContainText('3 giờ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('tab', { name: 'Thu nhập' }).click();
  const row = page.getByRole('row').filter({ hasText: PLACE });
  await expect(row).toContainText('555.000 đ');
  await row.click();
  const detail = page.getByTestId('income-detail');
  await expect(detail).toContainText('555.000 đ');
  await detail.getByRole('button', { name: 'Ghi nhận đã nhận' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ghi nhận đã nhận' });
  await expect(dialog.getByLabel('Số tiền đã nhận')).toHaveValue('555,000');
  await dialog.getByLabel('Số tiền đã nhận').fill('500000');
  await dialog.getByRole('button', { name: 'Ghi nhận đã nhận' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(detail).toContainText('Nhận một phần');
  await expect(detail).toContainText('Còn thiếu 55.000 đ');
  await detail.getByRole('tab', { name: 'Lịch sử nhận' }).click();
  await expect(detail).toContainText('500.000 đ');
});
