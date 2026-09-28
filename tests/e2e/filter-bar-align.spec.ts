import { test, expect, type Page } from '@playwright/test';

// Hàng bộ lọc desktop: ô chọn cuối phải sát mép phải hàng tiêu đề (thẳng nút hành động), không dồn trái.
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

// Khoảng cách (px) từ mép phải ô chọn xa nhất tới mép phải khối PageHeader (h1 → div → div).
async function rightGap(page: Page) {
  await expect(page.locator('main [role="combobox"]:visible').first()).toBeVisible();
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll<HTMLElement>('main [role="combobox"]')].filter((el) => el.offsetParent);
    const header = document.querySelector('main h1')!.parentElement!.parentElement!;
    const last = Math.max(...boxes.map((b) => b.getBoundingClientRect().right));
    return Math.round(header.getBoundingClientRect().right - last);
  });
}

for (const path of ['/students', '/tuition', '/reports']) {
  test(`bộ lọc ${path} sát mép phải ở 1280px`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await page.goto(path);
    expect(Math.abs(await rightGap(page))).toBeLessThanOrEqual(2);
  });
}

test('mobile 390px vẫn dùng nút Lọc, không hiện ô chọn ngoài trang', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/students');
  await expect(page.getByRole('button', { name: /Lọc|Filter/ })).toBeVisible();
  await expect(page.locator('main [role="combobox"]:visible')).toHaveCount(0);
});
