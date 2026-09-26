import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

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

// Tạo 1 ca hôm nay gắn HS rồi điểm danh "Có mặt" (giống mobile.spec.ts).
async function createPresentSession(page: Page, studentName: string, startHour: number, title: string) {
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
  await expect(page.getByText('Tạo ca dạy thành công').first()).toBeVisible();

  await page.getByText(title).filter({ visible: true }).first().click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('button', { name: 'Có mặt' }).first().click();
  await detail.getByRole('button', { name: 'Lưu điểm danh' }).click();
  await expect(page.getByText('Đã lưu điểm danh').first()).toBeVisible();
  await page.keyboard.press('Escape');
}

async function deleteSession(page: Page, title: string) {
  await page.goto('/calendar');
  await page.getByText(title).filter({ visible: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
  await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
  await expect(page.getByText('Đã xóa ca dạy').first()).toBeVisible();
}

async function openNoticeFromCard(page: Page, studentName: string) {
  await page.goto('/tuition');
  await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
  const card = page.getByTestId('list-card').filter({ hasText: studentName });
  // Thẻ mobile bọc ngoài cũng có role="button" (bấm cả thẻ mở chi tiết) → tên chính xác
  // mới khớp đúng nút icon "Phiếu báo" lồng bên trong, tránh strict-mode violation.
  const btn = card.getByRole('button', { name: 'Phiếu báo', exact: true });
  await expect(btn).toBeVisible();
  await expectTouchTarget(btn);
  await btn.click();
  return card;
}

// Tải ảnh → kiểm tên file, rộng 720px (360 × scale 2), và ảnh không trắng trơn.
async function downloadAndCheck(page: Page, notice: Locator) {
  const btn = notice.getByRole('button', { name: 'Tải ảnh' });
  await expect(btn).toBeEnabled();
  await expectTouchTarget(btn);
  const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  expect(download.suggestedFilename()).toMatch(/^phieu-bao-hoc-phi-T\d{1,2}-\d{4}-.+\.png$/);
  const png = readFileSync((await download.path())!);
  expect(png.length).toBeGreaterThan(0);
  expect(png.readUInt32BE(16)).toBe(720); // IHDR: bề rộng ảnh
  const darkPixels = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i + 1] < 100 && d[i + 2] < 100) n++;
    return n;
  }, png.toString('base64'));
  expect(darkPixels).toBeGreaterThan(5000);
}

test.describe('Phiếu báo học phí (390px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Headless không có bảng chia sẻ → bỏ Web Share để luôn đi nhánh tải file.
      delete (Navigator.prototype as { share?: unknown }).share;
      delete (Navigator.prototype as { canShare?: unknown }).canShare;
      // Huy hiệu dev của Next đè góc trái dưới ở 390px.
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

  // HS để lại trong DB test (đã có dòng học phí); DB test được reset khi chạy `pnpm test`.
  test('cài ngân hàng → phiếu có QR → tải ảnh → mở lại từ sheet → xoá ngân hàng', async ({ page }) => {
    const stamp = Date.now();
    const studentName = `HS Phiếu Nguyễn Thị Hường ${stamp}`;
    const titles = [`Ca phiếu A ${stamp}`, `Ca phiếu B ${stamp}`];
    const startHour = Math.floor(Math.random() * 4) + 13; // 13 tới 16, ca thứ 2 cách 2 giờ

    // 1. Cài đặt ngân hàng từ menu avatar
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.getByRole('menuitem', { name: 'Cài đặt' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await page.getByLabel('Ngân hàng').click();
    await page.getByRole('option', { name: /^Vietcombank - / }).click();
    await page.getByLabel('Số tài khoản').fill('0011001234567');
    const holder = page.getByLabel('Tên chủ tài khoản');
    await holder.fill('nguyen van a');
    await holder.blur();
    await expect(holder).toHaveValue('NGUYEN VAN A');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu tài khoản ngân hàng')).toBeVisible();
    await expectNoHorizontalScroll(page);

    // 2. HS học phí 150.000/buổi + 2 ca có mặt hôm nay
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.locator('input#tuitionFee').fill('150000');
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();
    await createPresentSession(page, studentName, startHour, titles[0]);
    await createPresentSession(page, studentName, startHour + 2, titles[1]);

    // 3. Mở phiếu từ thẻ mobile
    const card = await openNoticeFromCard(page, studentName);
    const notice = page.getByTestId('tuition-notice');
    const noticeCard = notice.getByTestId('notice-card');
    await expect(noticeCard.getByText(studentName)).toBeVisible();
    await expect(noticeCard.getByText('Còn phải trả')).toBeVisible();
    await expect(noticeCard.getByText('300.000 đ').first()).toBeVisible();
    await expect(noticeCard.locator('img[src^="data:image/png"]')).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Chia sẻ' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await downloadAndCheck(page, notice);
    await page.keyboard.press('Escape');
    await expect(notice).toHaveCount(0);

    // 4. Mở lại từ sheet chi tiết (dữ liệu đã cache → chụp ngay khi khung còn trượt vào)
    await card.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Phiếu báo' }).click();
    await expect(noticeCard.getByText(studentName)).toBeVisible();
    await expect(noticeCard.locator('img[src^="data:image/png"]')).toBeVisible();
    await downloadAndCheck(page, notice);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // 5. Xoá thông tin ngân hàng → phiếu có dòng nhắc, không QR
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Xoá thông tin' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xoá thông tin' }).click();
    await expect(page.getByLabel('Số tài khoản')).toHaveValue('');
    await openNoticeFromCard(page, studentName);
    await expect(notice.getByText('Chưa cài tài khoản ngân hàng nên phiếu chưa có mã QR.')).toBeVisible();
    await expect(notice.getByRole('link', { name: 'Mở Cài đặt' })).toHaveAttribute('href', '/settings');
    await expect(noticeCard.locator('img')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 6. Dọn ca để lần chạy sau cùng ngày không vướng trùng giờ
    for (const title of titles) await deleteSession(page, title);
  });
});
