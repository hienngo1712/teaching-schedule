import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

test.use({ viewport: { width: 390, height: 844 } });

const db = new PrismaClient();
const NAME = `E2E Phụ huynh ${Math.floor(Math.random() * 100000)}`;
let studentId = 0;
const sessionIds: number[] = [];

function vnDay(offset: number): string {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + offset))
    .toISOString()
    .slice(0, 10);
}
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

async function hideDevBadge(page: Page) {
  // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
}

// Context mới, không cookie: đúng góc nhìn phụ huynh.
async function openAsParent(browser: Browser, url: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await hideDevBadge(page);
  const res = await page.goto(url);
  return { context, page, res };
}

test.beforeAll(async () => {
  // Ghi thẳng DB: phải chắc đang trỏ DB test, không phải production.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  const subject = await db.subject.findFirstOrThrow({ where: { userId: user.id, isActive: true } });
  const createdAt = new Date();
  createdAt.setUTCMonth(createdAt.getUTCMonth() - 3); // để có "Tháng trước"
  const student = await db.student.create({
    data: { userId: user.id, fullName: NAME, grade: 5, tuitionFee: 100000, createdAt },
  });
  studentId = student.id;
  for (const [date, attendance] of [[vnDay(0), 'present'], [vnDay(7), 'pending']] as const) {
    const s = await db.teachingSession.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        sessionDate: new Date(`${date}T00:00:00Z`),
        startTime: time('05:00'),
        endTime: time('05:30'),
        sessionStudents: { create: { studentId, attendance, fee: 100000, grade: 5 } },
      },
    });
    sessionIds.push(s.id);
  }
});

test.afterAll(async () => {
  await db.teachingSession.deleteMany({ where: { id: { in: sessionIds } } });
  await db.monthlyTuition.deleteMany({ where: { studentId } });
  await db.student.deleteMany({ where: { id: studentId } });
  await db.$disconnect();
});

test('giáo viên tạo link, phụ huynh xem không cần đăng nhập, tạo lại và tắt thì link chết', async ({ page, browser }) => {
  await hideDevBadge(page);
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Mở dialog từ menu ⋯ của HS
  await page.goto('/students');
  await page.getByPlaceholder('Tìm tên học sinh...').filter({ visible: true }).first().fill(NAME);
  // Debounce 400ms rồi router.push đổi query — chờ điều hướng ổn định trước khi thao tác,
  // tránh race giữa RSC re-render và click vào menu (menu bị unmount giữa chừng).
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const menuBtn = page.getByRole('button', { name: 'Menu hành động' }).filter({ visible: true });
  await expect(menuBtn).toHaveCount(1);
  await menuBtn.click();
  await page.getByRole('menuitem', { name: 'Link phụ huynh' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(`Link phụ huynh · ${NAME}`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Tạo link' }).click();
  const urlBox = dialog.getByTestId('parent-link-url');
  await expect(urlBox).toHaveValue(/\/p\/[A-Za-z0-9_-]{43}$/);
  const url1 = await urlBox.inputValue();

  // Phụ huynh mở link
  const parent = await openAsParent(browser, url1);
  expect(parent.res!.status()).toBe(200);
  const headers = parent.res!.headers();
  expect(headers['x-robots-tag']).toContain('noindex');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cache-control']).toContain('no-store');
  await expect(parent.page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(parent.page.getByRole('heading', { name: NAME })).toBeVisible();
  await expect(parent.page.getByText('Còn phải trả').first()).toBeVisible();
  await expect(parent.page.getByText('Có mặt', { exact: true })).toBeVisible();
  await expect(parent.page.getByRole('heading', { name: 'Lịch sắp tới' })).toBeVisible();
  const [y, m, d] = vnDay(7).split('-');
  await expect(parent.page.getByText(new RegExp(`${d}/${m} · 05:00`))).toBeVisible();
  const overflow = await parent.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const prevLink = parent.page.getByRole('link', { name: /Tháng trước/ });
  expect((await prevLink.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Đổi tháng
  const monthBefore = await parent.page.getByTestId('parent-month').textContent();
  await prevLink.click();
  await expect(parent.page).toHaveURL(/\?thang=\d{4}-\d{2}$/);
  await expect(parent.page.getByTestId('parent-month')).not.toHaveText(monthBefore ?? '');

  // Tham số tháng lặp → vẫn 200, về tháng hiện tại
  const dup = await parent.page.goto(`${url1}?thang=${y}-${m}&thang=2020-01`);
  expect(dup!.status()).toBe(200);
  await parent.context.close();

  // Tạo lại → link cũ 404
  await dialog.getByRole('button', { name: 'Tạo lại link' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã tạo link mới')).toBeVisible();
  await expect(urlBox).not.toHaveValue(url1);
  const url2 = await urlBox.inputValue();
  const old = await openAsParent(browser, url1);
  expect(old.res!.status()).toBe(404);
  await old.context.close();

  // Tắt → link mới cũng 404, dialog quay về trạng thái chưa có link
  await dialog.getByRole('button', { name: 'Tắt link' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã tắt link')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tạo link' })).toBeVisible();
  const disabled = await openAsParent(browser, url2);
  expect(disabled.res!.status()).toBe(404);
  await disabled.context.close();

  // Token không tồn tại → 404, không bị chuyển sang /login
  const origin = new URL(url1).origin;
  const missing = await openAsParent(browser, `${origin}/p/khongtontai`);
  expect(missing.res!.status()).toBe(404);
  await expect(missing.page).not.toHaveURL(/login/);
  await missing.context.close();
});

test('route khác vẫn chuyển về /login khi chưa đăng nhập', async ({ page }) => {
  await page.goto('/students');
  await expect(page).toHaveURL(/.*login/);
});
