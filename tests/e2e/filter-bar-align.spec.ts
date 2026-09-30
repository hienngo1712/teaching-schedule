import { test, expect, type Page } from '@playwright/test';

// Hàng bộ lọc desktop: ô tìm và các bộ lọc liền nhau dồn từ trái sang, cùng chiều cao, không bị đẩy sát phải.
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function leftLayout(page: Page) {
  await expect(page.locator('main [role="combobox"]:visible').first()).toBeVisible();
  return page.evaluate(() => {
    const search = document.querySelector<HTMLElement>('main input[placeholder]')!.getBoundingClientRect();
    const first = [...document.querySelectorAll<HTMLElement>('main [role="combobox"]')]
      .filter((el) => el.offsetParent)
      .map((el) => el.getBoundingClientRect())
      .sort((a, b) => a.left - b.left)[0];
    return {
      gap: Math.round(first.left - search.right),
      sameRow: Math.abs(first.top - search.top) < 8,
      h: [Math.round(search.height), Math.round(first.height)],
    };
  });
}

for (const path of ['/students', '/tuition']) {
  test(`bộ lọc ${path} dồn trái ngay sau ô tìm ở 1280px`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await page.goto(path);
    const layout = await leftLayout(page);
    expect(layout.sameRow).toBe(true);
    expect(layout.gap).toBeGreaterThanOrEqual(0);
    expect(layout.gap).toBeLessThanOrEqual(16);
    expect(Math.abs(layout.h[0] - layout.h[1])).toBeLessThanOrEqual(1);
  });
}

test('bộ lọc /reports (không ô tìm) dồn sát mép trái ở 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/reports');
  await expect(page.locator('main [role="combobox"]:visible').first()).toBeVisible();
  const diff = await page.evaluate(() => {
    const h1 = document.querySelector<HTMLElement>('main h1')!.getBoundingClientRect();
    const first = [...document.querySelectorAll<HTMLElement>('main [role="combobox"]')]
      .filter((el) => el.offsetParent)
      .map((el) => el.getBoundingClientRect())
      .sort((a, b) => a.left - b.left)[0];
    return Math.abs(Math.round(first.left - h1.left));
  });
  expect(diff).toBeLessThanOrEqual(2);
});

test('mobile 390px vẫn dùng nút Lọc, không hiện ô chọn ngoài trang', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/students');
  await expect(page.getByRole('button', { name: /Lọc|Filter/ })).toBeVisible();
  await expect(page.locator('main [role="combobox"]:visible')).toHaveCount(0);
});
