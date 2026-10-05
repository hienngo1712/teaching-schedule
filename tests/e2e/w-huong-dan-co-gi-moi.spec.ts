import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { RELEASES } from '../../src/lib/releases';

test.describe.configure({ mode: 'serial' });

const db = new PrismaClient();
const LATEST = RELEASES[0].version;
const LATEST_NOTIFY = RELEASES.find((r) => r.notify)!;

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await db.user.update({ where: { username: 'teacher_std' }, data: { lastSeenRelease: null, onboardingDismissedAt: null } });
});

test.afterAll(async () => {
  await db.user.update({ where: { username: 'teacher_std' }, data: { lastSeenRelease: LATEST, onboardingDismissedAt: new Date() } });
  await db.$disconnect();
});

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Spec W', () => {
  test('/guide và /updates mở được khi chưa đăng nhập', async ({ page }) => {
    await page.goto('/guide');
    await expect(page.getByRole('heading', { level: 1, name: 'Hướng dẫn sử dụng' })).toBeVisible();
    await expect(page.locator('section#hoc-sinh')).toBeVisible();
    await page.goto('/updates');
    await expect(page.getByRole('heading', { level: 1, name: 'Các bản cập nhật' })).toBeVisible();
    await expect(page.locator(`[id="v${LATEST}"]`)).toBeVisible();
  });

  test('chưa xem bản mới: ô tự mở 1 lần, đóng xong tải lại không mở; thẻ Bắt đầu hiện', async ({ page }) => {
    await login(page, 'teacher_std');
    await expect(page.getByText(LATEST_NOTIFY.title)).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByText(LATEST_NOTIFY.title)).toBeHidden();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeVisible();
    await expect(page.getByText(LATEST_NOTIFY.title)).toBeHidden();
    const u = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
    expect(u.lastSeenRelease).toBe(LATEST_NOTIFY.version);
  });

  test('bấm Ẩn thẻ Bắt đầu → mất hẳn sau khi tải lại', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.getByRole('button', { name: 'Ẩn thẻ Bắt đầu' }).click();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeHidden();
    await page.reload();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeHidden();
  });

  test('Tìm hiểu thêm mở /updates ở tab mới', async ({ page, context }) => {
    await login(page, 'teacher');
    await page.getByRole('button', { name: /Có gì mới/ }).click();
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: /Tìm hiểu thêm/ }).click(),
    ]);
    await expect(tab).toHaveURL(new RegExp(`/updates#v${LATEST_NOTIFY.version.replace(/\./g, '\\.')}$`));
  });

  test('/guide: ảnh minh hoạ tải được, chuyển Điện thoại đổi ảnh', async ({ page }) => {
    await page.goto('/guide');
    const fig = page.locator('section#hoc-phi [data-testid="guide-shot"]').first();
    await fig.scrollIntoViewIfNeeded();
    // Chưa chọn thì có 2 ảnh, CSS ẩn ảnh sai khổ: chỉ xét ảnh đang hiện.
    const img = fig.locator('img:visible');
    await expect(img).toHaveAttribute('src', /-desktop\.jpg$/);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1280);
    await fig.getByRole('button', { name: 'Điện thoại' }).click();
    await expect(img).toHaveAttribute('src', /-mobile\.jpg$/);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(780);
  });
});
