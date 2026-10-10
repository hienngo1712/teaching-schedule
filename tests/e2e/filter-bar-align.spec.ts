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

// AK: ô lọc vào nút "Bộ lọc" (popover). Thanh 1 hàng ở 1280px: ô tìm → (Trạng thái) → Bộ lọc, không cuộn ngang.
for (const path of ['/students', '/tuition']) {
  test(`thanh lọc ${path} 1 hàng ở 1280px, Bộ lọc nằm ngay sau ô tìm`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await page.goto(path);
    const search = page.getByPlaceholder(/Tìm tên học sinh/);
    const filter = page.getByRole('button', { name: /^Bộ lọc/ });
    await expect(search).toBeVisible();
    await expect(filter).toBeVisible();
    const [sb, fb] = [(await search.boundingBox())!, (await filter.boundingBox())!];
    expect(Math.abs(sb.y + sb.height / 2 - (fb.y + fb.height / 2))).toBeLessThanOrEqual(4);
    expect(fb.x).toBeGreaterThan(sb.x + sb.width);
    expect(Math.abs(sb.height - fb.height)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

// AK: Báo cáo = Bộ lọc · kỳ · Xuất Excel trên 1 hàng; chọn lớp trong Bộ lọc ra chip.
test('/reports 1280px: Bộ lọc, kỳ báo cáo, Xuất Excel cùng 1 hàng; chọn lớp có chip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/reports');
  const filter = page.getByRole('button', { name: /^Bộ lọc/ });
  const excel = page.getByRole('button', { name: /Xuất Excel/ });
  await expect(filter).toBeVisible();
  await expect(excel).toBeVisible();
  const [fb, eb] = [(await filter.boundingBox())!, (await excel.boundingBox())!];
  expect(Math.abs(fb.y - eb.y)).toBeLessThanOrEqual(4);
  await filter.click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Lớp' }).click();
  await page.getByRole('option', { name: 'Lớp 5' }).click();
  await expect(page).toHaveURL(/grade=5/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Bỏ lọc Lớp 5' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bộ lọc (1)' })).toBeVisible();
});

// [RF 2] chế độ Khoảng ở 360px: nhãn rút gọn, không cuộn ngang.
test('/reports 360px chế độ Khoảng: nhãn T1–T3/2026, không tràn ngang', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await login(page);
  await page.goto('/reports?type=range&year=2026&month=1&toYear=2026&toMonth=3');
  await expect(page.getByText('T1–T3/2026')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('mobile 390px vẫn dùng nút Lọc, không hiện ô chọn ngoài trang', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/students');
  await expect(page.getByRole('button', { name: /Lọc|Filter/ })).toBeVisible();
  await expect(page.locator('main [role="combobox"]:visible')).toHaveCount(0);
});

// AK: Thêm học sinh lên đầu trang (PageHeader), Nâng lớp hàng loạt vào menu ⋯ của thanh lọc.
test('/students 1280px: Thêm học sinh ở đầu trang trên thanh lọc, Nâng lớp hàng loạt trong ⋯', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/students');
  const search = page.getByPlaceholder(/Tìm tên học sinh/);
  const add = page.getByRole('button', { name: /Thêm học sinh/ }).first();
  await expect(search).toBeVisible();
  await expect(add).toBeVisible();
  const [sb, ab] = [(await search.boundingBox())!, (await add.boundingBox())!];
  expect(ab.y + ab.height).toBeLessThan(sb.y);
  await expect(page.getByRole('button', { name: /Nâng lớp hàng loạt/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm thao tác' }).click();
  await expect(page.getByRole('menuitem', { name: /Nâng lớp hàng loạt|Đã nâng lớp năm/ })).toBeVisible();
});
