import { test, expect } from '@playwright/test';

test.describe('Student management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
    await page.goto('/students');
  });

  test('add and then delete a student', async ({ page }) => {
    await page.goto('/students');
    await page.click('text=Thêm học sinh');
    
    await page.fill('input[id="fullName"]', 'Học sinh E2E');
    // For shadcn select, we often need to click the trigger and then the item
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    
    await page.locator('button:has-text("Thêm")').last().click();
    
    await expect(page.locator('text=Đã thêm học sinh')).toBeVisible();
    // Tên có cả trong bảng (desktop) và thẻ mobile ẩn bằng CSS → chỉ kiểm tra ô bảng
    await expect(page.getByRole('cell', { name: 'Học sinh E2E' })).toBeVisible();

    // Delete
    await page.click('tr:has-text("Học sinh E2E") button:has(svg)');
    await page.click('text=Xóa');
    await page.click('button:has-text("Xóa")'); // Confirm in AlertDialog
    
    await expect(page.locator('text=Đã xóa học sinh')).toBeVisible();
    await expect(page.getByText('Học sinh E2E')).toHaveCount(0);
  });

  test('thêm HS lớp 12 thấy nhãn THPT, rồi xóa', async ({ page }) => {
    const name = `HS cap ba ${Math.floor(Math.random() * 1_000_000)}`;
    await page.click('text=Thêm học sinh');
    await page.fill('input[id="fullName"]', name);
    await page.click('button#grade');
    // exact: 'Lớp 1' / 'Lớp 12' là chuỗi con của nhau, thiếu exact sẽ khớp nhiều option.
    await page.getByRole('option', { name: 'Lớp 12', exact: true }).click();
    await page.locator('button:has-text("Thêm")').last().click();

    await expect(page.locator('text=Đã thêm học sinh')).toBeVisible();
    const row = page.locator('tr', { hasText: name });
    await expect(row).toBeVisible();
    await expect(row).toContainText('THPT');
    await expect(row).not.toContainText('THCS');

    await page.click(`tr:has-text("${name}") button:has(svg)`);
    await page.click('text=Xóa');
    await page.click('button:has-text("Xóa")');
    await expect(page.locator('text=Đã xóa học sinh')).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
