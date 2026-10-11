import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// Spec AN §2: /n/<token> công khai, chỉ đọc, noindex, không bao giờ có tên HS; token sai → 404.
const db = new PrismaClient();
const PLACE = `TT E2E Người trả ${Date.now().toString().slice(-5)}`;
const SECRET = `HS Kín ${Date.now().toString().slice(-5)}`;
const TOKEN = randomBytes(32).toString('base64url');

async function cleanup() {
  const places = await db.teachingPlace.findMany({ where: { name: { startsWith: 'TT E2E Người trả' } }, select: { id: true } });
  const ids = places.map((p) => p.id);
  await db.teachingSession.deleteMany({ where: { placeId: { in: ids } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: 'HS Kín' } } });
  await db.teachingPlace.deleteMany({ where: { id: { in: ids } } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  const u = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  await db.user.update({ where: { id: u.id }, data: { bankBin: '970436', bankAccountNumber: '0123456789', bankAccountName: 'GIAO VIEN TEST' } });
  const place = await db.teachingPlace.create({
    data: {
      userId: u.id, name: PLACE, kind: 'center', color: '#0891B2',
      billingChanges: { create: { fromKey: 0, billing: 'per_session' } },
      rateChanges: { create: { fromKey: 0, unit: 'hour', amount: 185000 } },
      // Ghi thẳng DB (bỏ qua mã hoá): trang chỉ tra theo hash.
      shareLink: { create: { token: TOKEN, tokenHash: createHash('sha256').update(TOKEN, 'utf8').digest('hex') } },
    },
  });
  const subject = (await db.subject.findFirst({ where: { userId: u.id } }))!;
  const st = await db.student.create({ data: { userId: u.id, fullName: SECRET, grade: 5, placeId: place.id } });
  const vn = new Date(Date.now() + 7 * 3600_000);
  await db.teachingSession.create({
    data: {
      userId: u.id, placeId: place.id, subjectId: subject.id, title: SECRET,
      sessionDate: new Date(`${vn.toISOString().slice(0, 10)}T00:00:00.000Z`),
      startTime: new Date('1970-01-01T08:00:00.000Z'), endTime: new Date('1970-01-01T09:30:00.000Z'),
      sessionStudents: { create: { studentId: st.id, attendance: 'present', grade: 5 } },
    },
  });
});
test.afterAll(async () => {
  await cleanup();
  await db.user.update({ where: { username: 'teacher' }, data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } });
  await db.$disconnect();
});

test('mở /n/<token> không đăng nhập: thấy QR + số tiền, noindex, không có tên HS; token sai → 404', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const res = await page.goto(`/n/${TOKEN}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: PLACE })).toBeVisible();
  await expect(page.getByTestId('place-notice-qr').getByRole('img', { name: 'VietQR' })).toBeVisible();
  await expect(page.getByTestId('place-notice-card')).toContainText('277.500 đ');
  await expect(page.getByTestId('payer-sessions')).toContainText('1 HS có mặt');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(await page.content()).not.toContain(SECRET);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const bad = await page.goto(`/n/${'A'.repeat(43)}`);
  expect(bad?.status()).toBe(404);
});
