import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const DAY = 24 * 60 * 60 * 1000;

async function loginAs(browser: Browser, username: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
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
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/overview$/ : /.*dashboard/);
  return page;
}

// Nửa đêm UTC của ngày VN (cột DATE), như vnDayDate.
function vnDay(d: Date): Date {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}
const dm = (d: Date) => {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
};
const num = async (page: Page, id: string) => Number((await page.getByTestId(`card-${id}`).locator('p').nth(1).textContent())?.trim());

let stdId = 0;
test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  stdId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  await db.userActivityDay.deleteMany({ where: { userId: stdId } });
  const y = new Date(Date.now() - DAY);
  await db.userActivityDay.create({ data: { userId: stdId, day: vnDay(y), firstSeenAt: y } });
});

test.afterAll(async () => {
  await db.userActivityDay.deleteMany({ where: { userId: stdId } });
  await db.user.update({ where: { id: stdId }, data: { lastActiveAt: null } });
  await db.$disconnect();
});

test('desktop: admin vào /admin/overview; 9 thẻ; teacher_std dùng app → Active 24h ≥ 1; cột hôm qua có quay lại; 7/14/30; thẻ Chờ duyệt → /admin/orders', async ({ browser }) => {
  const teacher = await loginAs(browser, 'teacher_std', DESKTOP);
  await teacher.goto('/students');
  await teacher.context().close();

  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await expect(admin.locator('aside').getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
  const cards = admin.getByTestId('overview-cards');
  for (const id of ['total', 'active', 'pending', 'active24h', 'active7d', 'paying', 'trial', 'expiring', 'std-after-trial']) {
    await expect(cards.getByTestId(`card-${id}`)).toBeVisible();
    expect(Number.isInteger(await num(admin, id))).toBe(true);
  }
  expect(await num(admin, 'active24h')).toBeGreaterThanOrEqual(1);
  expect(await num(admin, 'active7d')).toBeGreaterThanOrEqual(1);
  await expect(admin.getByText(/^Cập nhật lúc \d{2}\/\d{2} \d{2}:\d{2}$/)).toBeVisible();

  const chart = admin.getByTestId('trend-chart');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(7);
  await expect(chart.getByTestId('chart-bar').last()).toHaveAttribute('data-faded', 'true');
  await expect(chart.getByRole('img', { name: new RegExp(`^${dm(new Date(Date.now() - DAY))}: \\d+ tài khoản mới, [1-9]\\d* quay lại$`) })).toBeVisible();

  await admin.getByRole('radio', { name: '14 ngày' }).click();
  await expect(chart.getByTestId('chart-bar')).toHaveCount(14);
  await admin.getByRole('radio', { name: '30 ngày' }).click();
  await expect(chart.getByTestId('chart-bar')).toHaveCount(30);
  await expect(chart.getByTestId('chart-bar').last()).toHaveAttribute('data-faded', 'true');

  await admin.getByTestId('card-pending').click();
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.context().close();
});

test('390px: tab bar 7 tab ≥44px, không tràn ngang, thẻ 2 cột, nút 7/14/30 ≥44px', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test', MOBILE);
  const tabs = admin.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(7);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(tabs.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');

  const a = (await admin.getByTestId('card-total').boundingBox())!;
  const b = (await admin.getByTestId('card-active').boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x);

  for (const name of ['7 ngày', '14 ngày', '30 ngày']) {
    expect((await admin.getByRole('radio', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await admin.getByRole('radio', { name: '30 ngày' }).click();
  await expect(admin.getByTestId('trend-chart').getByTestId('chart-bar')).toHaveCount(30);
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await admin.context().close();
});
