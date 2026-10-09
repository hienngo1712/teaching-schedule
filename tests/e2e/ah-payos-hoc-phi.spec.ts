import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { vnDateParts } from '@/lib/utils';
import { keyToYearMonth } from '@/lib/payment-allocation';
import { monthKey } from '@/lib/billing';
import { signWebhookData } from '../../src/server/payos';

// Spec AH: GV Pro nối payOS → phiếu có QR payOS → webhook → "PH đã chuyển" + Đã đóng đủ; GV Plus thấy thẻ khoá.
const db = new PrismaClient();
const SHOTS = '.superpowers/sdd/2026-10-09-ah-payos-hoc-phi';
const KEYS = { clientId: 't-client', apiKey: 't-api', checksumKey: 't-checksum' };
const NAME = 'E2E AH Payos';

test.describe.configure({ mode: 'serial' });

async function clean() {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  await db.teacherPayos.deleteMany({ where: { userId: user.id } });
  const students = await db.student.findMany({ where: { userId: user.id, fullName: { startsWith: 'E2E AH ' } }, select: { id: true } });
  const ids = students.map((s) => s.id);
  if (ids.length > 0) {
    const sessions = await db.sessionStudent.findMany({ where: { studentId: { in: ids } }, select: { sessionId: true } });
    await db.tuitionPayLink.deleteMany({ where: { studentId: { in: ids } } });
    await db.payment.deleteMany({ where: { monthlyTuition: { studentId: { in: ids } } } });
    await db.monthlyTuition.deleteMany({ where: { studentId: { in: ids } } });
    await db.sessionStudent.deleteMany({ where: { studentId: { in: ids } } });
    await db.teachingSession.deleteMany({ where: { id: { in: sessions.map((s) => s.sessionId) } } });
    await db.student.deleteMany({ where: { id: { in: ids } } });
  }
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

async function openAs(browser: Browser, username: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  // Huy hiệu dev của Next đè góc màn hình, che nút khi chụp ảnh.
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
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

async function noOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

async function openStudentRow(page: Page) {
  await page.goto('/tuition');
  await page.getByPlaceholder('Tìm tên học sinh...').locator('visible=true').first().fill(NAME);
  const name = page.getByText(NAME).locator('visible=true').first();
  await expect(name).toBeVisible();
  return name;
}

test.beforeAll(clean);
test.afterAll(async () => {
  await clean();
  await db.$disconnect();
});

for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}px: GV Pro kết nối payOS → phiếu QR payOS → webhook → PH đã chuyển, Đã đóng đủ; GV Plus thấy thẻ khoá`, async ({ browser, request }) => {
    await clean();
    const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
    const subject = await db.subject.findFirstOrThrow({ where: { userId: user.id, isActive: true } });
    const nowVn = vnDateParts();
    const prev = keyToYearMonth(monthKey(nowVn.year, nowVn.month) - 1);
    const st = await db.student.create({ data: { userId: user.id, fullName: NAME, grade: 5, tuitionFee: 100000 } });
    await db.teachingSession.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        sessionDate: new Date(`${prev.year}-${String(prev.month).padStart(2, '0')}-10T00:00:00Z`),
        startTime: new Date('1970-01-01T05:00:00Z'),
        endTime: new Date('1970-01-01T05:45:00Z'),
        sessionStudents: { create: { studentId: st.id, attendance: 'present', fee: 100000, grade: 5 } },
      },
    });

    // 1. Cài đặt: dán 3 khoá, Kết nối (mock 4010 nhận confirm-webhook).
    const page = await openAs(browser, 'teacher', vp);
    await page.goto('/settings');
    const card = page.getByTestId('payos-card');
    await expect(card).toBeVisible();
    await card.getByLabel('Client ID').fill(KEYS.clientId);
    await card.getByLabel('API Key').fill(KEYS.apiKey);
    await card.getByLabel('Checksum Key').fill(KEYS.checksumKey);
    const connect = card.getByRole('button', { name: 'Kết nối' });
    expect((await connect.boundingBox())!.height).toBeGreaterThanOrEqual(vp.width < 768 ? 44 : 36);
    await connect.click();
    await expect(card).toContainText('Đã kết nối payOS từ');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/ah-1-ket-noi-${vp.width}.png`, fullPage: true });
    await noOverflow(page);

    // 2. Phiếu báo tháng trước: QR payOS, nội dung "HP <id>".
    await (await openStudentRow(page)).click();
    await page.locator("[role='dialog']").getByRole('button', { name: 'Phiếu báo' }).first().click();
    const notice = page.getByRole('dialog').filter({ has: page.getByText('Quét để trả, tự xác nhận khi tiền vào') });
    await expect(notice.getByText('Quét để trả, tự xác nhận khi tiền vào').locator('visible=true').first()).toBeVisible();
    await expect(notice.locator('img[alt="payOS"]').locator('visible=true').first()).toBeVisible();
    await expect(notice.getByText(/Nội dung: HP \d+/).locator('visible=true').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/ah-2-phieu-${vp.width}.png` });
    await noOverflow(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // 3. Giả webhook payOS ký bằng Checksum Key vừa dán → 200; tháng thành Đã đóng đủ + "PH đã chuyển".
    const teacherPayos = await db.teacherPayos.findUniqueOrThrow({ where: { userId: user.id } });
    const link = await db.tuitionPayLink.findFirstOrThrow({ where: { studentId: st.id, status: 'active' } });
    const data = {
      orderCode: link.id, amount: link.amount, description: `HP ${link.id}`, accountNumber: '0001234567', reference: `E2EAH${link.id}-${vp.width}`,
      transactionDateTime: '2026-10-09 14:32:00', currency: 'VND', paymentLinkId: link.payosLinkId, code: '00', desc: 'success',
      counterAccountBankId: '', counterAccountBankName: '', counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: '',
    };
    const res = await request.post(`/api/payos/tuition/${teacherPayos.hookId}`, {
      data: { code: '00', desc: 'success', success: true, data, signature: signWebhookData(KEYS.checksumKey, data) },
    });
    expect(res.status()).toBe(200);
    await openStudentRow(page);
    const row = page.locator(`tr:has-text("${NAME}"), [data-testid="list-card"]:has-text("${NAME}")`).locator('visible=true').first();
    await expect(row).toContainText('PH đã chuyển 100.000 đ lúc 14:32 ngày 9/10');
    await expect(row).toContainText('Đã đóng đủ');
    await page.screenshot({ path: `${SHOTS}/ah-3-da-chuyen-${vp.width}.png` });
    await noOverflow(page);
    await page.context().close();

    // 4. GV Plus: thẻ payOS bị khoá, có nút Mở khoá gói Pro.
    await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'plus', planExpiresAt: new Date(Date.now() + 30 * 86400_000) } });
    const plus = await openAs(browser, 'teacher_std', vp);
    await plus.goto('/settings');
    const lockedCard = plus.getByTestId('payos-card');
    await expect(lockedCard.getByTestId('locked-section')).toBeVisible();
    await expect(lockedCard).toContainText('Mở khoá gói Pro');
    await expect(lockedCard).toContainText('100 giao dịch miễn phí trọn đời + 500 miễn phí trong 6 tháng');
    await lockedCard.scrollIntoViewIfNeeded();
    await plus.screenshot({ path: `${SHOTS}/ah-4-khoa-${vp.width}.png`, fullPage: true });
    await noOverflow(plus);
    await plus.context().close();
  });
}
