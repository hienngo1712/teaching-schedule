import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// Spec AN §6: tạo phiếu nơi dạy → sao chép link → mở /n/<token> ở trang mới thấy QR + số tiền, không có tên HS.
const db = new PrismaClient();
const PLACE = `TT E2E Phiếu ${Date.now().toString().slice(-5)}`;
const SECRET = `HS Riêng ${Date.now().toString().slice(-5)}`;

async function cleanup() {
  const places = await db.teachingPlace.findMany({ where: { name: { startsWith: 'TT E2E Phiếu' } }, select: { id: true } });
  const ids = places.map((p) => p.id);
  await db.teachingSession.deleteMany({ where: { placeId: { in: ids } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: 'HS Riêng' } } });
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
  await db.user.update({ where: { username: 'teacher' }, data: { bankBin: '970436', bankAccountNumber: '0123456789', bankAccountName: 'GIAO VIEN TEST' } });
});
test.afterAll(async () => {
  await cleanup();
  await db.user.update({ where: { username: 'teacher' }, data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } });
  await db.$disconnect();
});

test('Thu nhập → Phiếu báo → Sao chép link → /n/<token> có QR + số tiền, không tên HS', async ({ page, context }) => {
  test.setTimeout(150_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  const vn = new Date(Date.now() + 7 * 3600_000);
  const py = vn.getUTCMonth() === 0 ? vn.getUTCFullYear() - 1 : vn.getUTCFullYear();
  const pm = vn.getUTCMonth() === 0 ? 12 : vn.getUTCMonth();
  const place = await trpc<{ id: number }>(page, 'place.create', { name: PLACE, kind: 'center', color: '#0891B2', billing: 'per_session' });
  await trpc(page, 'placeRate.set', { placeId: place.id, unit: 'hour', amount: 185000, fromYear: vn.getUTCFullYear(), fromMonth: vn.getUTCMonth() + 1 });
  const u = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  const subject = (await db.subject.findFirst({ where: { userId: u.id } }))!;
  const st = await db.student.create({ data: { userId: u.id, fullName: SECRET, grade: 5, placeId: place.id } });
  for (const d of ['10', '12']) {
    await db.teachingSession.create({
      data: {
        userId: u.id, placeId: place.id, subjectId: subject.id, title: SECRET,
        sessionDate: new Date(`${py}-${String(pm).padStart(2, '0')}-${d}T00:00:00.000Z`),
        startTime: new Date('1970-01-01T08:00:00.000Z'), endTime: new Date('1970-01-01T09:30:00.000Z'),
        sessionStudents: { create: { studentId: st.id, attendance: 'present', grade: 5 } },
      },
    });
  }

  await page.goto(`/timesheet?tab=income&year=${py}&month=${pm}`);
  const row = page.getByRole('row').filter({ hasText: PLACE });
  await expect(row).toContainText('555.000 đ');
  await expect(row).toContainText('Chưa gửi phiếu');
  await row.getByTestId('place-notice-button').click();
  const dialog = page.getByTestId('place-notice');
  await expect(dialog.getByTestId('place-notice-card')).toContainText('555.000 đ');
  await expect(dialog.getByTestId('place-notice-qr')).toBeVisible();
  await dialog.getByRole('button', { name: 'Sao chép link gửi' }).click();
  await expect(page.getByText('Đã sao chép link phiếu')).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(new RegExp(`/n/[A-Za-z0-9_-]{43}\\?thang=${py}-${String(pm).padStart(2, '0')}$`));
  // Tự đánh dấu đã gửi.
  await expect(dialog.getByTestId('place-notice-sent')).toContainText('Đã gửi');

  const payer = await context.browser()!.newPage();
  await payer.setViewportSize({ width: 375, height: 812 });
  const res = await payer.goto(url);
  expect(res?.status()).toBe(200);
  await expect(payer.getByRole('heading', { name: PLACE })).toBeVisible();
  await expect(payer.getByTestId('place-notice-qr').getByRole('img', { name: 'VietQR' })).toBeVisible();
  await expect(payer.getByTestId('place-notice-card')).toContainText('555.000 đ');
  expect(await payer.content()).not.toContain(SECRET);
  await payer.close();
});
