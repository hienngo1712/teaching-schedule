import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Sao lưu dữ liệu (390px)', () => {
  test.beforeEach(async ({ page }) => {
    // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.head.appendChild(style);
      });
    });
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('menu avatar → Sao lưu dữ liệu → tải file .xlsx đủ sheet', async ({ page }) => {
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Sao lưu dữ liệu' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^SaoLuu_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);

    const filePath = await download.path();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    expect(wb.getWorksheet('Học sinh')).toBeDefined();
    expect(wb.getWorksheet('Lần thu')).toBeDefined();

    await expect(page.getByText('Đã tải file sao lưu')).toBeVisible();
  });
});
