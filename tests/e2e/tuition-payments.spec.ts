import { test, expect, type Page, type Locator } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test.describe('Lịch sử thu tiền (390px)', () => {
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

  test('thu 2 lần, sửa, xoá; Đã trả và badge cập nhật', async ({ page }) => {
    const studentName = `HS thu tiền ${Date.now()}`;
    const title = `Ca thu tiền ${Math.floor(Math.random() * 10000)}`;
    const startHour = Math.floor(Math.random() * 5) + 13; // 13:00 tới 17:00, tránh trùng ca có sẵn

    // 1. HS học phí 200.000/buổi
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.fill('input[id="tuitionFee"]', '200000');
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();

    // 2. Ca hôm nay gắn HS, điểm danh Có mặt → tháng này phải đóng 200.000
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Bắt đầu (HH:mm)').fill(`${startHour}00`);
    await form.getByLabel('Kết thúc (HH:mm)').fill(`${startHour + 1}00`);
    await form.getByLabel('Môn học').click();
    await page.getByRole('option').first().click();
    await form.getByPlaceholder('Nhóm nâng cao').fill(title);
    await form.getByLabel(new RegExp(studentName)).click();
    await form.getByRole('button', { name: 'Tạo ca dạy' }).click();
    await expect(page.getByText('Tạo ca dạy thành công')).toBeVisible();

    await page.getByText(title).filter({ visible: true }).first().click();
    const detail = page.getByRole('dialog');
    await detail.getByRole('button', { name: 'Có mặt' }).first().click();
    await detail.getByRole('button', { name: 'Lưu điểm danh' }).click();
    await expect(page.getByText('Đã lưu điểm danh')).toBeVisible();
    await page.keyboard.press('Escape');

    // 3. /tuition → Ghi nhận
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const card = page.getByTestId('list-card').filter({ hasText: studentName });
    await card.getByRole('button', { name: 'Ghi nhận', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Chi tiết học phí' });
    await expect(sheet.getByText('Chưa có lần thu nào')).toBeVisible();
    await expectNoHorizontalScroll(page);
    const addBtn = sheet.getByRole('button', { name: 'Thu tiền', exact: true });
    await expectTouchTarget(addBtn);

    // 4. Lần 1: 100.000 tiền mặt (mặc định)
    await addBtn.click();
    let payForm = page.getByRole('dialog', { name: /Thu tiền tháng/ });
    await expect(payForm.getByRole('button', { name: 'Tiền mặt' })).toHaveAttribute('aria-pressed', 'true');
    await payForm.getByLabel('Số tiền').fill('100000');
    await payForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText(/Đã lưu lần thu/).first()).toBeVisible();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(1);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/100\.000/);
    await expectTouchTarget(sheet.getByTestId('payment-row').first().getByRole('button', { name: 'Menu hành động' }));

    // 5. Lần 2: nút "Số còn lại" (100.000), chuyển khoản
    await sheet.getByRole('button', { name: 'Thu tiền', exact: true }).click();
    payForm = page.getByRole('dialog', { name: /Thu tiền tháng/ });
    await payForm.getByRole('button', { name: /Số còn lại/ }).click();
    await expect(payForm.getByLabel('Số tiền')).toHaveValue('100,000');
    await payForm.getByRole('button', { name: 'Chuyển khoản' }).click();
    await payForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(2);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/200\.000/);

    // Badge trên thẻ đổi thành "Đã đóng đủ"
    await page.keyboard.press('Escape');
    await expect(card.getByText('Đã đóng đủ')).toBeVisible();
    await card.getByRole('button', { name: 'Ghi nhận', exact: true }).click();

    // 6. Sửa lần 1 (tiền mặt) thành 50.000
    const cashRow = sheet.getByTestId('payment-row').filter({ hasText: 'Tiền mặt' });
    await cashRow.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Sửa' }).click();
    const editForm = page.getByRole('dialog', { name: 'Sửa lần thu' });
    await editForm.getByLabel('Số tiền').fill('50000');
    await editForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(sheet.getByTestId('paid-total')).toHaveText(/150\.000/);

    // 7. Xoá lần 2 (chuyển khoản), có xác nhận
    const transferRow = sheet.getByTestId('payment-row').filter({ hasText: 'Chuyển khoản' });
    await transferRow.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(1);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/50\.000/);
    await expectNoHorizontalScroll(page);

    // 8. Dọn dữ liệu: xoá ca rồi xoá HS (xoá mềm)
    await page.keyboard.press('Escape');
    await page.goto('/calendar');
    await page.getByText(title).filter({ visible: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
    await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();

    await page.goto('/students');
    const studentCard = page.getByTestId('list-card').filter({ hasText: studentName });
    await studentCard.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xóa học sinh')).toBeVisible();
  });
});
