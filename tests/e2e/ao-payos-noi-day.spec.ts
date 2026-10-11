import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { signWebhookData } from '../../src/server/payos';
// = PLACE_ORDER_OFFSET (place-paylink.service); không import service server vào tiến trình Playwright.
const PLACE_ORDER_OFFSET = 1_000_000_000;

// Spec AO §5: GV Pro đã nối payOS (mock payOS ở 127.0.0.1:4010) mở phiếu nơi dạy có QR payOS → trang người trả có
// nút "Mở trang thanh toán" → webhook giả có chữ ký → Thu nhập "Đã nhận đủ" + chuông có dòng nơi dạy.
const db = new PrismaClient();
const KEY = 't-checksum';
const HOOK = 'O'.repeat(43);
const PLACE = `TT E2E payOS ${Date.now().toString().slice(-5)}`;

async function cleanup() {
  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  await db.teacherPayos.deleteMany({ where: { userId: user.id } });
  const places = await db.teachingPlace.findMany({ where: { name: { startsWith: 'TT E2E payOS' } }, select: { id: true } });
  const ids = places.map((p) => p.id);
  await db.teachingSession.deleteMany({ where: { placeId: { in: ids } } });
  await db.teachingPlace.deleteMany({ where: { id: { in: ids } } });
  await db.user.update({ where: { id: user.id }, data: { payosSeenAt: null } });
}

async function trpc<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).result.data as T;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test('375px: phiếu nơi dạy QR payOS → webhook → Thu nhập Đã nhận đủ + chuông có dòng, bấm mở đúng nơi', async ({ page, context, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  await db.teacherPayos.create({ data: { userId: user.id, clientId: 't-client', apiKey: 't-api', checksumKey: KEY, hookId: HOOK } });
  const vn = new Date(Date.now() + 7 * 3600_000);
  const py = vn.getUTCMonth() === 0 ? vn.getUTCFullYear() - 1 : vn.getUTCFullYear();
  const pm = vn.getUTCMonth() === 0 ? 12 : vn.getUTCMonth();
  const mm = String(pm).padStart(2, '0');
  const place = await trpc<{ id: number }>(page, 'place.create', { name: PLACE, kind: 'center', color: '#0891B2', billing: 'per_session' });
  await trpc(page, 'placeRate.set', { placeId: place.id, unit: 'session', amount: 150000, fromYear: vn.getUTCFullYear(), fromMonth: vn.getUTCMonth() + 1 });
  const subject = (await db.subject.findFirst({ where: { userId: user.id } }))!;
  for (const d of ['10', '12']) {
    await db.teachingSession.create({
      data: {
        userId: user.id, placeId: place.id, subjectId: subject.id, sessionDate: new Date(`${py}-${mm}-${d}T00:00:00.000Z`),
        startTime: new Date('1970-01-01T08:00:00.000Z'), endTime: new Date('1970-01-01T09:30:00.000Z'),
      },
    });
  }

  // 1. Thu nhập → Phiếu báo: QR payOS (mock), nội dung ND <id>.
  await page.goto(`/timesheet?tab=income&year=${py}&month=${pm}`);
  // 375: danh sách dạng thẻ (bảng desktop ẩn).
  const card = page.getByTestId('list-card').filter({ hasText: PLACE });
  await expect(card).toBeVisible();
  await card.getByTestId('place-notice-button').click();
  const dialog = page.getByTestId('place-notice');
  await expect(dialog.getByTestId('place-notice-qr').getByRole('img', { name: 'payOS' })).toBeVisible();
  await expect(dialog.getByTestId('place-notice-card')).toContainText('300.000 đ');
  await expect(dialog.getByTestId('place-notice-qr')).toContainText('Quét để trả, tự xác nhận khi tiền vào');
  await noOverflow(page);
  const link = await db.placePayLink.findFirstOrThrow({ where: { placeId: place.id, status: 'active' } });
  expect(link.amount).toBe(300000);

  // 2. Trang người trả: cùng link payOS, có nút Mở trang thanh toán.
  const { path } = await trpc<{ path: string }>(page, 'placeNotice.link', { placeId: place.id });
  const payer = await context.newPage();
  await payer.setViewportSize({ width: 375, height: 812 });
  await payer.goto(`${path}?thang=${py}-${mm}`);
  await expect(payer.getByTestId('place-notice-qr').getByRole('img', { name: 'payOS' })).toBeVisible();
  await expect(payer.getByRole('link', { name: 'Mở trang thanh toán' })).toHaveAttribute('href', `https://pay.payos.vn/web/pl-${PLACE_ORDER_OFFSET + link.id}`);
  await noOverflow(payer);
  await payer.close();
  expect(await db.placePayLink.count({ where: { placeId: place.id } })).toBe(1);
  await page.keyboard.press('Escape');

  // 3. Webhook giả có chữ ký → 200, ghi Đã nhận.
  const data = {
    orderCode: PLACE_ORDER_OFFSET + link.id, amount: 300000, description: `ND ${link.id}`, accountNumber: '0001234567', reference: `E2EAO${link.id}`,
    transactionDateTime: '2026-10-09 14:32:00', currency: 'VND', paymentLinkId: link.payosLinkId, code: '00', desc: 'success',
    counterAccountBankId: '', counterAccountBankName: '', counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: '',
  };
  const res = await request.post(`/api/payos/tuition/${HOOK}`, { data: { code: '00', desc: 'success', success: true, data, signature: signWebhookData(KEY, data) } });
  expect(res.status()).toBe(200);

  // 4. Không F5: toast + Thu nhập Đã nhận đủ (chuông hỏi 30s/lần).
  await expect(page.getByText(`${PLACE} · Tháng ${pm} · +300.000 đ`).first()).toBeVisible({ timeout: 45_000 });
  await expect(card).toContainText('Đã nhận đủ');
  const bell = page.locator('button[aria-label="Thông báo tiền học"]');
  await expect(bell).toContainText('1');

  // 5. Mở chuông → dòng nơi dạy; bấm → Thu nhập tháng đó, sheet đúng nơi.
  await bell.click();
  const row = page.getByRole('dialog').getByRole('button', { name: new RegExp(`${PLACE} · Tháng ${pm}`) });
  await expect(row).toBeInViewport();
  await noOverflow(page);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/timesheet\\?tab=income&year=${py}&month=${pm}`));
  await expect(page.getByRole('dialog').filter({ hasText: PLACE })).toBeVisible();
  await expect(page).not.toHaveURL(/placeId=/);
});
