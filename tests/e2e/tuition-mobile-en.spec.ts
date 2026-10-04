import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// Tiếng Anh nút "Record Payment" dài nhất, cộng số tiền 9 chữ số → dễ đẩy thẻ học phí tràn ngang.
test('thẻ học phí 390px, tiếng Anh, 100.000.000 đ không làm trang cuộn ngang', async ({ page }) => {
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

  const studentName = `HS tiền lớn ${Date.now()}`;
  const stamp = Math.floor(Math.random() * 100000);
  const title = `Ca tiền lớn ${stamp}`;
  const startHour = Math.floor(Math.random() * 4) + 19; // 19:00 - 23:00, không trùng ca ban ngày
  const startMin = ['00', '15', '30'][Math.floor(Math.random() * 3)];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. HS học phí 100.000.000/buổi, 1 ca hôm nay có mặt
  await page.goto('/students');
  await page.getByRole('button', { name: 'Thêm học sinh' }).click();
  await page.fill('input[id="fullName"]', studentName);
  await page.click('button#grade');
  await page.getByRole('option', { name: 'Lớp 5' }).click();
  await page.fill('input[id="tuitionFee"]', '100000000');
  await page.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();
  await page.locator('button:has-text("Thêm")').last().click();
  await expect(page.getByText('Đã thêm học sinh')).toBeVisible();

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

  // 2. Đổi sang tiếng Anh, xem thẻ học phí (chỉ định year/month của tháng hiện tại vì /tuition mặc định tháng trước)
  await page.evaluate(() => localStorage.setItem('language', 'en'));
  await page.goto(`/tuition?year=${currentYear}&month=${currentMonth}`);
  await page.getByPlaceholder('Search student name...').fill(studentName);
  const card = page.getByTestId('list-card').filter({ hasText: studentName });
  await expect(card.getByText(/100\.000\.000/)).toBeVisible();
  // Tháng đang học (in_progress) không hiện nút 'Record Payment' hay 'Đã đóng đủ' ngoài card khi dueNow = 0
  const cardOverflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(cardOverflow).toBeLessThanOrEqual(0);
  await expectNoHorizontalScroll(page);

  // 3. Dọn dữ liệu (về tiếng Việt để dùng lại nhãn): xoá ca rồi xoá HS
  await page.evaluate(() => localStorage.setItem('language', 'vi'));
  await page.goto('/calendar');
  await page.getByText(title).filter({ visible: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
  await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
  await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();

  await page.goto('/students');
  const studentCard = page.getByTestId('list-card').filter({ hasText: studentName });
  await studentCard.getByRole('button', { name: 'Menu hành động' }).click();
  await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
  await expect(page.getByText('Đã chuyển học sinh vào Thùng rác')).toBeVisible();
});
