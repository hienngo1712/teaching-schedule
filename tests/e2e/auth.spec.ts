import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { decode, encode } from 'next-auth/jwt';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

// http://localhost nên cookie không có tiền tố __Secure-; salt mã hóa JWT = tên cookie.
const COOKIE = 'authjs.session-token';
const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
const REMEMBER = 'Ghi nhớ đăng nhập (30 ngày)';

const db = new PrismaClient();

test.beforeAll(() => {
  // Test dưới ghi DB bằng Prisma để khôi phục mật khẩu → chỉ chạy trên DB test.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
});
test.afterAll(async () => {
  await db.$disconnect();
});

async function restoreTeacherPassword() {
  await db.user.update({
    where: { username: 'teacher' },
    data: { passwordHash: await bcrypt.hash('teacher123', 4), mustChangePassword: false },
  });
}

async function loginForm(page: Page, remember: boolean) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  if (remember) await page.getByText(REMEMBER).click();
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function sessionPayload(context: BrowserContext) {
  const c = (await context.cookies()).find((x) => x.name === COOKIE);
  expect(c, 'thiếu cookie phiên').toBeTruthy();
  const payload = await decode({ token: c!.value, secret: SECRET, salt: COOKIE });
  expect(payload, 'không giải mã được cookie phiên').toBeTruthy();
  return { cookie: c!, payload: payload! };
}

test('redirect to /login when not authenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/.*login/);
});

test('login successfully and redirect to /dashboard', async ({ page }) => {
  await page.goto('/login');
  
  // Wait for the form to be ready
  await page.waitForSelector('input[name="username"]');
  
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: false })).toBeVisible();
});

test('logout successfully', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  
  // Click logout (it's in a dropdown)
  await page.click('button[aria-label="Mở menu tài khoản"]');
  await page.click('text=Đăng xuất');

  await expect(page).toHaveURL(/.*login/);
  // Đăng xuất đã xóa cookie → không hiện thông báo "hết phiên" (spec N 6.5).
  await expect(page.locator('form').getByRole('status')).toHaveCount(0);
});

test('checkbox ghi nhớ mặc định không tick, bấm vào chữ thì tick', async ({ page }) => {
  await page.goto('/login');
  const box = page.getByRole('checkbox', { name: REMEMBER });
  await expect(box).not.toBeChecked();
  await page.getByText(REMEMBER).click();
  await expect(box).toBeChecked();
});

test('tick ghi nhớ → cookie hết hạn ~30 ngày, token remember=true, epoch khớp package.json', async ({ page, context }) => {
  await loginForm(page, true);
  const { cookie, payload } = await sessionPayload(context);
  expect(Math.abs(cookie.expires - (Date.now() / 1000 + 30 * 24 * 3600))).toBeLessThan(3600);
  expect(payload.remember).toBe(true);
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
  expect(payload.epoch).toBe(version.split('.').slice(0, 2).join('.'));
});

test('không tick → token remember=false (cắt 8h đã phủ ở unit auth-jwt)', async ({ page, context }) => {
  await loginForm(page, false);
  const { payload } = await sessionPayload(context);
  expect(payload.remember).toBe(false);
});

test('token lệch epoch → về /login?expired=1, thấy thông báo, cookie bị xóa', async ({ page, context }) => {
  await loginForm(page, false);
  const { payload } = await sessionPayload(context);
  const forged = await encode({ token: { ...payload, epoch: '0.0-old' }, secret: SECRET, salt: COOKIE });
  await context.addCookies([{ name: COOKIE, value: forged, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/students');
  await expect(page).toHaveURL(/\/login\?.*expired=1/);
  await expect(page.locator('form').getByRole('status')).toHaveText(
    'Phiên đăng nhập đã hết hoặc có phiên bản mới. Vui lòng đăng nhập lại.'
  );
  expect((await context.cookies()).find((x) => x.name === COOKIE)).toBeUndefined();
});

test('đổi mật khẩu: máy đang đổi vẫn đăng nhập (giữ ghi nhớ), máy khác bị về /login?expired=1', async ({ browser }) => {
  const TEMP = 'TamThoi@2026x';
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  try {
    await loginForm(a, true);
    await loginForm(b, false);
    const before = (await sessionPayload(ctxA)).payload.sessionVersion as number;

    await a.click('button[aria-label="Mở menu tài khoản"]');
    await a.getByRole('menuitem', { name: 'Đổi mật khẩu' }).click();
    const dlg = a.getByRole('dialog');
    await dlg.locator('#current-pw').fill('teacher123');
    await dlg.locator('#new-pw').fill(TEMP);
    await dlg.locator('#confirm-pw').fill(TEMP);
    await dlg.locator('button[type="submit"]').click();
    await expect(a.getByText('Đổi mật khẩu thành công')).toBeVisible();

    await a.goto('/students');
    await expect(a).toHaveURL(/\/students$/);
    const after = (await sessionPayload(ctxA)).payload;
    expect(after.sessionVersion).toBe(before + 1);
    expect(after.remember).toBe(true);

    await b.goto('/students');
    await expect(b).toHaveURL(/\/login\?.*expired=1/);
  } finally {
    await restoreTeacherPassword();
    await ctxA.close();
    await ctxB.close();
  }
});
