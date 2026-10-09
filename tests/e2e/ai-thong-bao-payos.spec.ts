import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { vnDateParts } from '@/lib/utils';
import { keyToYearMonth } from '@/lib/payment-allocation';
import { monthKey } from '@/lib/billing';
import { signWebhookData } from '../../src/server/payos';

// Spec AI: GV đã nối payOS đang mở Tổng quan → webhook tiền vào → toast + chuông có số, không F5; bấm dòng mở đúng HS.
const db = new PrismaClient();
const SHOTS = '.superpowers/sdd/2026-10-09-ai-thong-bao-tien-payos';
const KEY = 't-checksum';
const HOOK = 'A'.repeat(43);
const NAME = 'E2E AI Payos';

test.describe.configure({ mode: 'serial' });

async function clean() {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  await db.teacherPayos.deleteMany({ where: { userId: user.id } });
  const students = await db.student.findMany({ where: { userId: user.id, fullName: { startsWith: 'E2E AI ' } }, select: { id: true } });
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
  await db.user.update({ where: { id: user.id }, data: { payosSeenAt: null } });
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

test.beforeAll(clean);
test.afterAll(async () => {
  await clean();
  await db.$disconnect();
});

for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}px: tiền payOS vào → toast + chuông số 1 không F5; mở chuông tắt số; bấm dòng mở đúng HS`, async ({ browser, request }) => {
    test.setTimeout(120_000);
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
    await db.teacherPayos.create({ data: { userId: user.id, clientId: 't-client', apiKey: 't-api', checksumKey: KEY, hookId: HOOK } });
    const link = await db.tuitionPayLink.create({
      data: { userId: user.id, studentId: st.id, year: prev.year, month: prev.month, amount: 100000, payosLinkId: `pl-ai-${vp.width}`, qrCode: 'q', checkoutUrl: 'c' },
    });

    // 1. Đang mở Tổng quan: header có chuông, không tràn ngang.
    const page = await openAs(browser, 'teacher', vp);
    await page.goto('/dashboard');
    // Theo aria-label, không theo role: Sheet mobile mở thì phần còn lại bị aria-hidden.
    const bell = page.locator('button[aria-label="Thông báo tiền học"]');
    await expect(bell).toBeVisible();
    expect((await bell.boundingBox())!.height).toBeGreaterThanOrEqual(vp.width < 768 ? 44 : 36);
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/ai-1-header-${vp.width}.png` });

    // 2. Giả webhook payOS ký bằng khoá giả → 200.
    const data = {
      orderCode: link.id, amount: 100000, description: `HP ${link.id}`, accountNumber: '0001234567', reference: `E2EAI${link.id}-${vp.width}`,
      transactionDateTime: '2026-10-09 14:32:00', currency: 'VND', paymentLinkId: link.payosLinkId, code: '00', desc: 'success',
      counterAccountBankId: '', counterAccountBankName: '', counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: '',
    };
    const res = await request.post(`/api/payos/tuition/${HOOK}`, { data: { code: '00', desc: 'success', success: true, data, signature: signWebhookData(KEY, data) } });
    expect(res.status()).toBe(200);

    // 3. Không reload: toast trong ≤ 45s, chuông có số 1.
    await expect(page.getByText(`PH của ${NAME} đã chuyển 100.000 đ`)).toBeVisible({ timeout: 45_000 });
    await expect(bell).toContainText('1');
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/ai-2-toast-${vp.width}.png` });

    // 4. Mở chuông: có dòng của HS, số chưa đọc tắt.
    await bell.click();
    const panel = page.getByRole('dialog').filter({ hasText: 'Tiền học qua payOS' });
    const row = panel.getByRole('button', { name: new RegExp(`PH của ${NAME} đã chuyển`) });
    // Chờ Sheet/Popover chạy xong hiệu ứng mở rồi mới chụp.
    await expect(row).toBeInViewport();
    await expect(bell).not.toContainText('1');
    await noOverflow(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/ai-3-chuong-${vp.width}.png` });

    // 5. Bấm dòng → trang Học phí mở sheet đúng HS.
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/tuition\\?year=${prev.year}&month=${prev.month}&studentId=${st.id}`));
    const sheet = page.getByRole('dialog').filter({ hasText: NAME });
    await expect(sheet).toBeVisible();
    await page.context().close();
  });
}
