import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Nhập học sinh từ Excel (390px)', () => {
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

  // HS nhập vào không xóa trong test → tên có tiền tố ngẫu nhiên; DB test được reset khi chạy `pnpm test`.
  test('tải mẫu, xem trước, nhập 2 em, nhập lại thấy trùng', async ({ page }, testInfo) => {
    const tag = `E2E-${Math.floor(Math.random() * 1_000_000)}`;
    const nameA = `${tag} An`;
    const nameB = `${tag} Bình`;

    await page.goto('/students');
    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    const dialog = page.getByRole('dialog');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Tải file mẫu' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mau-nhap-hoc-sinh.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await download.path());
    const sheet = wb.getWorksheet('Hoc sinh')!;
    sheet.addRow([nameA, 5, 'Chị Hoa', '0912345678', 150000, '']);
    sheet.addRow([nameB, 'Lớp 3', '', '', '', '']);
    sheet.addRow([`${tag} Lỗi`, 12, '', '', '', '']);
    const filePath = testInfo.outputPath('import.xlsx');
    await wb.xlsx.writeFile(filePath);

    await dialog.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(dialog.getByTestId('import-summary')).toHaveText('2 hợp lệ · 0 trùng · 1 lỗi');
    await expect(dialog.getByText('Lớp phải là số từ 1 đến 9')).toBeVisible();

    await dialog.getByRole('button', { name: 'Nhập 2 học sinh' }).click();
    await expect(page.getByText('Đã nhập 2 học sinh')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByPlaceholder('Tìm tên học sinh...').fill(tag);
    await expect(page.getByText(nameA, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(nameB, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(`${tag} Lỗi`)).toHaveCount(0);

    // Nhập lại đúng file → 2 dòng trùng, mặc định không nhập được gì
    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    await page.getByRole('dialog').getByTestId('import-file-input').setInputFiles(filePath);
    const again = page.getByRole('dialog');
    await expect(again.getByTestId('import-summary')).toHaveText('0 hợp lệ · 2 trùng · 1 lỗi');
    await expect(again.getByText(`Trùng với ${nameA} (lớp 5)`)).toBeVisible();
    await expect(again.getByRole('button', { name: 'Nhập 0 học sinh' })).toBeDisabled();

    // Tick "Vẫn nhập" 1 dòng → số trên nút đổi (không bấm nhập)
    await again.getByRole('checkbox', { name: 'Vẫn nhập' }).first().click();
    await expect(again.getByRole('button', { name: 'Nhập 1 học sinh' })).toBeEnabled();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
