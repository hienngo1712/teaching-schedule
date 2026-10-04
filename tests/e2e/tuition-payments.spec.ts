import { test, expect, type Page, type Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
test.afterAll(async () => {
  await db.$disconnect();
});

test.use({ viewport: { width: 390, height: 844 } });

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
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
    const stamp = Math.floor(Math.random() * 100000);
    const title = `Ca thu tiền ${stamp}`;
    const startHour = Math.floor(Math.random() * 4) + 19; // 19:00 - 23:00, không trùng ca ban ngày
    const startMin = ['00', '15', '30'][Math.floor(Math.random() * 3)];

    // 1. HS học phí 200.000/buổi
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.fill('input[id="tuitionFee"]', '200000');
    await page.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();

    // 2. Ca hôm nay gắn HS, điểm danh Có mặt → tháng này phải đóng 200.000
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Bắt đầu (HH:mm)').fill(`${startHour}${startMin}`);
    await form.getByLabel('Kết thúc (HH:mm)').fill(`${startHour + 1}${startMin}`);
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
    // Dời ca về tháng trước (tháng đã học xong, màn Học phí mở sẵn tháng này) để cần đóng = học phí thật.
    const now = new Date();
    const prev = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28)));
    expect((await db.teachingSession.updateMany({ where: { title }, data: { sessionDate: prev } })).count).toBe(1);

    // 3. /tuition (tháng trước) → mở sheet chi tiết
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const card = page.getByTestId('list-card').filter({ hasText: studentName });
    await card.click();
    const sheet = page.getByRole('dialog', { name: 'Chi tiết học phí' });
    await expect(sheet.getByText('Chưa có lần thu nào')).toBeVisible();
    await expectNoHorizontalScroll(page);

    // 4. Lần 1: Đóng một phần 100.000
    await expectTouchTarget(sheet.getByRole('button', { name: /^Đã đóng đủ/ }));
    await expectTouchTarget(sheet.getByRole('button', { name: 'Đóng một phần' }));
    await sheet.getByRole('button', { name: 'Đóng một phần' }).click();
    await sheet.getByLabel('Số tiền phụ huynh đưa').fill('100000');
    await sheet.getByRole('button', { name: 'Ghi nhận' }).click();
    await expect(page.getByText(/Đã ghi/).first()).toBeVisible();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(1);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/100\.000/);
    await expectTouchTarget(sheet.getByTestId('payment-row').first().getByRole('button', { name: 'Menu hành động' }));

    // 5. Lần 2: Đóng một phần 100.000 tiếp
    await sheet.getByRole('button', { name: 'Đóng một phần' }).click();
    await sheet.getByLabel('Số tiền phụ huynh đưa').fill('100000');
    await sheet.getByRole('button', { name: 'Ghi nhận' }).click();
    await expect(page.getByText(/Đã ghi/).first()).toBeVisible();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(2);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/200\.000/);

    // Badge trên thẻ đổi thành "Đã đóng đủ"
    await page.keyboard.press('Escape');
    await expect(card.getByText('Đã đóng đủ')).toBeVisible();
    await card.click();

    // 6. Sửa 1 đợt 100.000 thành 50.000
    const rowToEdit = sheet.getByTestId('payment-row').filter({ hasText: '100.000' }).first();
    await rowToEdit.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Sửa' }).click();
    const editForm = page.getByRole('dialog', { name: 'Sửa lần thu' });
    await editForm.getByLabel('Số tiền').fill('50000');
    await editForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(sheet.getByTestId('paid-total')).toHaveText(/150\.000/);

    // 7. Xoá đợt 100.000 còn lại, giữ đợt 50.000 vừa sửa
    const rowToDelete = sheet.getByTestId('payment-row').filter({ hasText: '100.000' });
    await rowToDelete.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xoá lần thu')).toBeVisible();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(1);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/50\.000/);
    await expectNoHorizontalScroll(page);

    // Xoá nốt dòng còn lại để HS sạch dữ liệu trước khi xoá HS
    const remainingRow = sheet.getByTestId('payment-row').first();
    await remainingRow.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xoá lần thu')).toBeVisible();
    await expect(sheet.getByTestId('paid-total')).toHaveText(/0 đ/);

    // 8. Dọn dữ liệu: xoá ca (đã dời sang tháng trước) rồi xoá HS (xoá mềm)
    await page.keyboard.press('Escape');
    await db.sessionStudent.deleteMany({ where: { session: { title } } });
    await db.teachingSession.deleteMany({ where: { title } });

    await page.goto('/students');
    const studentCard = page.getByTestId('list-card').filter({ hasText: studentName });
    await studentCard.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã chuyển học sinh vào Thùng rác')).toBeVisible();
  });
});
