import { test, expect } from '@playwright/test';

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
    await page.goto('/calendar');
  });

  test('create and delete a session', async ({ page }) => {
    const sessionTitle = `Ca E2E ${Math.floor(Math.random() * 10000)}`;
    const startHour = Math.floor(Math.random() * 5) + 13; // 13:00 to 17:00

    await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
    const form = page.getByRole('dialog');

    // TimeInput là ô text tự chèn dấu ":" nên gõ số liền.
    await form.getByLabel('Bắt đầu (HH:mm)').fill(`${startHour}00`);
    await form.getByLabel('Kết thúc (HH:mm)').fill(`${startHour + 1}00`);
    await form.getByLabel('Môn học').click();
    await page.getByRole('option').first().click();
    await form.getByPlaceholder('Nhóm nâng cao').fill(sessionTitle);
    await form.getByRole('button', { name: 'Tạo ca dạy' }).click();

    await expect(page.getByText('Tạo ca dạy thành công')).toBeVisible();
    await expect(page.getByText(sessionTitle).first()).toBeVisible();

    await page.getByText(sessionTitle).first().click();
    await page.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();

    await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();
    await expect(page.getByText(sessionTitle)).toHaveCount(0);
  });
});
