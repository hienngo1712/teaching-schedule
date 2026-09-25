import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const SCREENS = [
  { tab: 'Tổng quan', url: /dashboard/ },
  { tab: 'Lịch dạy', url: /calendar/ },
  { tab: 'Học sinh', url: /students/ },
  { tab: 'Học phí', url: /tuition/ },
  { tab: 'Báo cáo', url: /reports/ },
];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Mobile 390px', () => {
  test.beforeEach(async ({ page }) => {
    // Huy hiệu dev của Next (góc trái dưới, chỉ có khi `next dev`) đè lên tab đầu tiên ở 390px.
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

  test('thanh tab đáy chuyển đủ 5 màn, không màn nào tràn ngang', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav).toBeVisible();
    for (const s of SCREENS) {
      await nav.getByRole('link', { name: s.tab }).click();
      await expect(page).toHaveURL(s.url);
      await expect(nav.getByRole('link', { name: s.tab })).toHaveAttribute('aria-current', 'page');
      await expectNoHorizontalScroll(page);
    }
  });

  // Mobile không có thẻ ca tô màu cấp học (chỉ có sọc màu môn) → chú thích màu cấp học sẽ gây hiểu nhầm.
  test('màn Lịch không hiện chú thích màu cấp học trên mobile', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: 'Tạo ca dạy' }).first()).toBeVisible();
    await expect(page.getByText('Hỗn hợp')).toBeHidden();
  });

  // Seed không có học sinh → test tự tạo HS (tên dài để thử truncate), tạo ca gắn HS đó, rồi tự dọn.
  // Bảng desktop và lưới lịch vẫn nằm trong DOM (chỉ bị ẩn bằng CSS) nên phải lọc phần tử đang hiện.
  test('thẻ học sinh + điểm danh một ca trên mobile', async ({ page }) => {
    const studentName = `HS tên rất dài để kiểm tra layout mobile ${Date.now()}`;
    const title = `Ca mobile ${Math.floor(Math.random() * 10000)}`;
    const startHour = Math.floor(Math.random() * 5) + 13; // 13:00 tới 17:00, tránh trùng ca có sẵn

    // 1. Tạo HS, kiểm tra màn Học sinh dạng thẻ
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();

    const studentCard = page.getByTestId('list-card').filter({ hasText: studentName });
    await expect(page.locator('table')).toBeHidden();
    await expect(studentCard).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Thẻ cuối phải cuộn tới được, không bị thanh phân trang + tab bar che
    const lastCard = page.getByTestId('list-card').last();
    await lastCard.scrollIntoViewIfNeeded();
    const cardBox = await lastCard.boundingBox();
    const tabBox = await page.getByRole('navigation', { name: 'Điều hướng chính' }).boundingBox();
    expect(cardBox!.y + cardBox!.height).toBeLessThan(tabBox!.y);

    // 2. Tạo ca hôm nay gắn HS vừa tạo
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Bắt đầu (HH:mm)').fill(`${startHour}00`);
    await form.getByLabel('Kết thúc (HH:mm)').fill(`${startHour + 1}00`);
    await form.getByLabel('Môn học').click();
    await page.getByRole('option').first().click();
    await form.getByPlaceholder('Nhóm nâng cao').fill(title);
    await form.getByLabel(new RegExp(studentName)).click(); // checkbox trong StudentPicker
    await form.getByRole('button', { name: 'Tạo ca dạy' }).click();
    await expect(page.getByText('Tạo ca dạy thành công')).toBeVisible();

    // 3. Mở ca → điểm danh
    const sessionItem = page.getByText(title).filter({ visible: true }).first();
    await sessionItem.click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText(studentName)).toBeVisible();

    const dialogOverflow = await detail.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(dialogOverflow).toBeLessThanOrEqual(0);

    const saveBtn = detail.getByRole('button', { name: 'Lưu điểm danh' });
    await expect(saveBtn).toBeInViewport();
    await detail.getByRole('button', { name: 'Có mặt' }).first().click();
    await saveBtn.click();
    await expect(page.getByText('Đã lưu điểm danh')).toBeVisible();

    // 4. Dọn dữ liệu: xóa ca rồi xóa HS
    await page.getByText(title).filter({ visible: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
    await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();

    await page.goto('/students');
    await studentCard.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xóa học sinh')).toBeVisible();
  });
});
