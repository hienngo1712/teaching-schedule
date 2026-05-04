import { test, expect } from '@playwright/test';

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*calendar/);
  });

  test('create and delete a session', async ({ page }) => {
    const sessionTitle = `Ca E2E ${Math.floor(Math.random() * 10000)}`;
    const startHour = Math.floor(Math.random() * 5) + 13; // 13:00 to 17:00
    await page.goto('/calendar');
    await page.click('text=Tạo ca dạy');
    
    await page.fill('input[placeholder*="Nhóm nâng cao"]', sessionTitle);
    await page.fill('input[type="time"]', `${startHour}:00`);
    await page.locator('input[type="time"]').last().fill(`${startHour + 1}:00`);
    
    // Wait for the dialog to be stable
    await page.locator('button:has-text("Tạo ca dạy")').last().click();
    
    await expect(page.locator('text=Tạo ca dạy thành công')).toBeVisible();
    
    // Verify it appeared in the calendar (might be in mobile list or grid)
    await expect(page.locator(`text=${sessionTitle}`).first()).toBeVisible();

    // Open detail and delete
    await page.click(`text=${sessionTitle}`);
    await page.click('button[aria-label="Menu hành động"]');
    await page.click('text=Xóa ca dạy');
    await page.click('button:has-text("Xóa ca dạy")');
    
    await expect(page.locator('text=Đã xóa ca dạy')).toBeVisible();
    await expect(page.locator(`text=${sessionTitle}`)).not.toBeVisible();
  });
});
