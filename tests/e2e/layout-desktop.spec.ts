import { test, expect, type Page } from '@playwright/test';

// Số tiền 9 chữ số (Còn nợ cộng dồn) trên thẻ thống kê không được tràn thẻ, từ điện thoại tới laptop.
const WIDTHS = [390, 1024, 1280, 1366];
const BIG_AMOUNT = '100.000.000 đ';

async function expectStatCardsFit(page: Page) {
  await expect(page.getByTestId('stat-value').first()).toBeVisible();
  const overflow = await page.evaluate((text) => {
    document.querySelectorAll('[data-testid="stat-value"]').forEach((el) => (el.textContent = text));
    const cards = [...document.querySelectorAll<HTMLElement>('[data-testid="stat-card"]')];
    const main = document.querySelector('main')!;
    return {
      cards: cards.filter((c) => c.offsetParent && c.scrollWidth > c.clientWidth).length,
      main: main.scrollWidth - main.clientWidth,
    };
  }, BIG_AMOUNT);
  expect(overflow).toEqual({ cards: 0, main: 0 });
}

test.describe('Thẻ số liệu với số tiền lớn', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  for (const width of WIDTHS) {
    test(`Dashboard + Báo cáo không tràn ở ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/dashboard');
      await expectStatCardsFit(page);
      await page.goto('/reports');
      await expectStatCardsFit(page);
    });
  }
});

test.describe('Sidebar desktop 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('nhóm Quản lý có Môn học, Cài đặt; link đang mở có aria-current', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Quản lý', { exact: true })).toBeVisible();

    await sidebar.getByRole('link', { name: 'Môn học' }).click();
    await expect(page).toHaveURL(/\/subjects/);
    await expect(sidebar.getByRole('link', { name: 'Môn học' })).toHaveAttribute('aria-current', 'page');

    await sidebar.getByRole('link', { name: 'Cài đặt' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(sidebar.getByRole('link', { name: 'Cài đặt' })).toHaveAttribute('aria-current', 'page');
  });

  test('nút Tạo ca dạy dùng màu nhấn #0F766E', async ({ page }) => {
    await page.goto('/calendar');
    const btn = page.getByRole('button', { name: 'Tạo ca dạy' }).first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  });

  // Lưới lịch nền slate-200 (làm vạch kẻ): ô hôm nay tô màu nhấn trong suốt sẽ lộ nền xám.
  test('ô hôm nay trên lịch nền trắng phủ màu nhấn nhạt', async ({ page }) => {
    await page.goto('/calendar');
    const today = page.locator('.calendar-day-cell--today').first();
    await expect(today).toBeVisible();
    await expect(today).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(today).toHaveCSS('background-image', /rgba\(15, 118, 110, 0\.08\)/);
  });
});

// Biến --font-geist-sans gắn ở <body>; nếu font-family chỉ đặt ở <html> (preflight) thì var() rỗng → rơi về serif.
test('chữ toàn app dùng Geist, không rơi về serif', async ({ page }) => {
  await page.goto('/login');
  const family = await page.evaluate(() => getComputedStyle(document.querySelector('h1, h2, button')!).fontFamily);
  expect(family).toMatch(/geist/i);
});
