import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function subjectOptionCount(page: Page, name: string) {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Môn học').click();
  await expect(page.getByRole('option').first()).toBeVisible();
  const count = await page.getByRole('option', { name }).count();
  await page.keyboard.press('Escape'); // đóng listbox
  await page.keyboard.press('Escape'); // đóng dialog
  return count;
}

test.describe('Quản lý môn học (390px)', () => {
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

  // Môn chỉ ẩn được, không xóa → tên ngẫu nhiên tiền tố E2E; DB test được reset khi chạy `pnpm test`.
  test('thêm, đổi màu, ẩn rồi hiện lại một môn', async ({ page }) => {
    const name = `E2E môn có tên khá dài để kiểm tra truncate ${Math.floor(Math.random() * 100000)}`;

    // Vào từ tab Thêm (menu avatar không còn mục Môn học)
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Thêm' }).getByRole('link', { name: /Môn học/ }).click();
    await expect(page.getByRole('dialog', { name: 'Thêm' })).toBeHidden();
    await expect(page).toHaveURL(/\/subjects/);

    // Thêm môn
    await page.getByRole('button', { name: 'Thêm môn' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tên môn').fill(name);
    await dialog.getByRole('button', { name: '#DB2777' }).click();
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu môn học')).toBeVisible();

    const card = page.getByTestId('subject-card').filter({ hasText: name });
    await expect(card).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Đổi màu
    await card.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Sửa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '#65A30D' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu môn học').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Ẩn → không còn trong ô chọn môn khi tạo ca
    await card.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Ẩn' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Ẩn', exact: true }).click();
    await expect(page.getByTestId('subjects-hidden').getByText(name)).toBeVisible();
    expect(await subjectOptionCount(page, name)).toBe(0);

    // Hiện lại → có lại trong ô chọn môn
    await page.goto('/subjects');
    await card.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Hiện lại' }).click();
    await expect(page.getByTestId('subjects-active').getByText(name)).toBeVisible();
    expect(await subjectOptionCount(page, name)).toBe(1);
  });
});
