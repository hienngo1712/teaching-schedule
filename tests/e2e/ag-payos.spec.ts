import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { signWebhookData } from '../../src/server/payos';

// Spec AG: mua gói qua payOS tự kích hoạt, đơn payOS cần admin xử lý, khối Liên hệ chủ app.
const db = new PrismaClient();
const SHOTS = '.superpowers/sdd/2026-10-09-ag-payos-mua-goi';
const CHECKSUM_KEY = 'test-checksum-key'; // khớp PAYOS_CHECKSUM_KEY giả trong playwright.config.ts
const CONTACT = { phone: '0979479550', facebookUrl: 'https://www.facebook.com/ngo.quang.hien.657661' };

test.describe.configure({ mode: 'serial' });

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

async function openAs(browser: Browser, username: string | null, viewport: { width: number; height: number }): Promise<Page> {
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
  if (username) {
    await page.goto('/login');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/\/login/);
  }
  return page;
}

async function noOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

async function openPurchasePro(page: Page) {
  await page.goto('/plan');
  await page.getByTestId('plan-card-pro').getByRole('button', { name: 'Chọn gói Pro' }).click();
  const popup = page.getByTestId('plan-purchase');
  await expect(popup).toBeVisible();
  return popup;
}

test.beforeAll(async () => {
  // Ghi thẳng DB: phải chắc đang trỏ DB test, không phải production.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
  await db.contactChange.deleteMany();
  await db.contactChange.create({ data: { ...CONTACT, changedBy: 'admin_test' } });
});

test.afterAll(async () => {
  await resetStd();
  await db.contactChange.deleteMany();
  await db.$disconnect();
});

for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}px: chọn payOS → thẻ QR payOS; webhook có chữ ký → popup báo đã kích hoạt, gói thành Pro`, async ({ browser, request }) => {
    await resetStd();
    const page = await openAs(browser, 'teacher_std', vp);
    const popup = await openPurchasePro(page);

    const group = popup.getByRole('radiogroup', { name: 'Cách thanh toán' });
    await expect(group).toBeVisible();
    await expect(popup.getByTestId('purchase-method-payos')).toHaveAttribute('aria-checked', 'true');
    await expect(popup.getByTestId('purchase-method-vietqr')).toHaveAttribute('aria-checked', 'false');
    for (const m of ['payos', 'vietqr']) {
      expect((await popup.getByTestId(`purchase-method-${m}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/pay-method-${vp.width}.png` });
    await noOverflow(page);

    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    const pending = popup.getByTestId('pending-order');
    await expect(pending).toBeVisible();
    await expect(pending.getByRole('img', { name: 'payOS' })).toBeVisible();
    const open = pending.getByRole('link', { name: 'Mở trang thanh toán' });
    await expect(open).toHaveAttribute('target', '_blank');
    await expect(pending).toContainText('Quét QR để thanh toán, gói bật ngay khi tiền vào.');
    await page.screenshot({ path: `${SHOTS}/payos-card-${vp.width}.png`, fullPage: true });
    await noOverflow(page);

    const order = await db.planOrder.findFirstOrThrow({
      where: { user: { username: 'teacher_std' }, status: 'pending' },
      orderBy: { id: 'desc' },
    });
    expect(order).toMatchObject({ method: 'payos', payosLinkId: `pl-${order.id}` });
    const data = {
      orderCode: order.id, amount: order.amount, description: `SM ${order.code}`, accountNumber: '0123456789',
      reference: `E2E${order.id}`, transactionDateTime: '2026-10-09 20:15:00', currency: 'VND', paymentLinkId: `pl-${order.id}`,
      code: '00', desc: 'success', counterAccountBankId: '', counterAccountBankName: '', counterAccountName: null,
      counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: '',
    };
    const res = await request.post('/api/payos/webhook', {
      data: { code: '00', desc: 'success', success: true, data, signature: signWebhookData(CHECKSUM_KEY, data) },
    });
    expect(res.status()).toBe(200);

    // usePlan hỏi lại mỗi 5s khi có đơn payOS chờ.
    await expect(popup.getByText('Đã nhận tiền, gói đã được kích hoạt.')).toBeVisible({ timeout: 15000 });
    expect((await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).plan).toBe('pro');
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.id } })).decidedBy).toBe('payos');
    await noOverflow(page);
    await page.context().close();
  });
}

test('375px: chọn VietQR → thẻ có dòng báo admin + khối Liên hệ 3 nút', async ({ browser }) => {
  await resetStd();
  const page = await openAs(browser, 'teacher_std', { width: 375, height: 812 });
  const popup = await openPurchasePro(page);
  await popup.getByTestId('purchase-method-vietqr').click();
  await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
  const pending = popup.getByTestId('pending-order');
  await expect(pending).toBeVisible();
  await expect(pending.getByRole('img', { name: 'VietQR' })).toBeVisible();
  await expect(pending).toContainText('Chuyển khoản xong, báo admin để được duyệt:');
  const contact = pending.getByTestId('contact-owner');
  await expect(contact).toContainText('0979 479 550');
  await expect(contact.getByRole('link')).toHaveCount(3);
  for (const link of await contact.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await contact.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/vietqr-contact-375.png` });
  await noOverflow(page);
  await page.context().close();
});

test('375px admin: đơn hết hạn đã nhận tiền payOS nằm trên cùng, Xác nhận → gói bật', async ({ browser }) => {
  // Đơn chờ thường (VietQR) từ test trước còn đó: đơn cần xử lý phải đứng trước nó.
  const std = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
  const expired = await db.planOrder.create({
    data: {
      userId: std.id, plan: 'pro', period: 'month', amount: 99000, code: 'EXPAY2', status: 'expired', method: 'payos',
      payosLinkId: 'pl-e2e-expired', paidAmount: 99000, paidAt: new Date(), payosRef: `E2E-EXP-${Date.now()}`,
      createdAt: new Date(Date.now() - 8 * 86400_000), decidedAt: new Date(Date.now() - 86400_000),
    },
  });
  const page = await openAs(browser, 'admin_test', { width: 375, height: 812 });
  await page.goto('/admin/orders');
  const att = page.getByTestId('attention-order').filter({ hasText: 'EXPAY2' });
  await expect(att).toBeVisible();
  await expect(att).toContainText('nhưng đơn đã hết hạn. Duyệt?');
  await expect(att).toContainText('payOS');
  const cards = page.getByTestId('pending-order-card');
  if ((await cards.count()) > 0) {
    const attY = (await att.boundingBox())!.y;
    for (const c of await cards.all()) {
      if (await c.isVisible()) expect(attY).toBeLessThan((await c.boundingBox())!.y);
    }
  }
  await page.screenshot({ path: `${SHOTS}/admin-attention-375.png`, fullPage: true });
  await noOverflow(page);

  await att.getByRole('button', { name: 'Xác nhận' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(att).toHaveCount(0);
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe('approved');
  expect((await db.user.findUniqueOrThrow({ where: { id: std.id } })).plan).toBe('pro');
  await page.context().close();
});

test('375px /guide chưa đăng nhập: mục Cần hỗ trợ? có số liên hệ', async ({ browser }) => {
  const page = await openAs(browser, null, { width: 375, height: 812 });
  await page.goto('/guide');
  const help = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Cần hỗ trợ?' }) });
  await expect(help).toBeVisible();
  await expect(help).toContainText('0979 479 550');
  await expect(help.getByRole('link', { name: /Facebook/ })).toHaveAttribute('href', CONTACT.facebookUrl);
  await help.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/guide-contact-375.png` });
  await noOverflow(page);
  await page.context().close();
});
