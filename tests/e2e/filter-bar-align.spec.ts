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

test('bộ lọc /reports (không ô tìm) dồn sát mép trái khung lọc ở 1280px', async ({ page }) => {
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
  // Bộ lọc nằm trong khung trắng (viền 1px + padding 16px) như thanh Lịch dạy.
  expect(diff).toBeLessThanOrEqual(20);
});

test('mobile 390px vẫn dùng nút Lọc, không hiện ô chọn ngoài trang', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/students');
  await expect(page.getByRole('button', { name: /Lọc|Filter/ })).toBeVisible();
  await expect(page.locator('main [role="combobox"]:visible')).toHaveCount(0);
});

// Hotfix 0.8.2: như thanh Lịch dạy — ô tìm, bộ lọc và nút hành động cùng 1 hàng trong 1 khung.
test('/students 1280px: nút Thêm học sinh cùng hàng với ô tìm, sát mép phải khung', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/students');
  const search = page.getByPlaceholder(/Tìm tên học sinh/);
  const add = page.getByRole('button', { name: /Thêm học sinh/ }).first();
  await expect(search).toBeVisible();
  await expect(add).toBeVisible();
  const [sb, ab] = [await search.boundingBox(), await add.boundingBox()];
  expect(Math.abs(sb!.y + sb!.height / 2 - (ab!.y + ab!.height / 2))).toBeLessThanOrEqual(4);
  expect(ab!.x).toBeGreaterThan(sb!.x + sb!.width);
});
