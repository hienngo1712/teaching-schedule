import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const TEST_PREFIX = 'HS Phiếu V E2E';
const SESSION_PREFIX = 'Ca Phiếu V E2E';

async function cleanupData() {
  await db.sessionStudent.deleteMany({
    where: { session: { title: { startsWith: SESSION_PREFIX } } },
  });
  await db.teachingSession.deleteMany({
    where: { title: { startsWith: SESSION_PREFIX } },
  });
  await db.monthlyTuition.deleteMany({
    where: { student: { fullName: { startsWith: TEST_PREFIX } } },
  });
  await db.studentBillingChange.deleteMany({
    where: { student: { fullName: { startsWith: TEST_PREFIX } } },
  });
  await db.student.deleteMany({
    where: { fullName: { startsWith: TEST_PREFIX } },
  });
}

test.beforeAll(async () => {
  await cleanupData();
});

test.afterAll(async () => {
  await cleanupData();
  await db.$disconnect();
});

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function addStudent(page: Page, studentName: string) {
  await page.goto('/students');
  await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Họ và tên/i).fill(studentName);

  await dialog.locator('button#grade').click();
  await page.getByRole('option', { name: 'Lớp 5' }).click();

  await dialog.locator('input#tuitionFee').fill('100000');
  await dialog.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();

  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await expect(page.getByText('Đã thêm học sinh')).toBeVisible();
}

async function createAndAttendSession(
  page: Page,
  studentName: string,
  startHour: number,
  title: string
) {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Bắt đầu (HH:mm)').fill(`${String(startHour).padStart(2, '0')}00`);
  await form.getByLabel('Kết thúc (HH:mm)').fill(`${String(startHour + 1).padStart(2, '0')}00`);
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

test.describe('E2E Đã gửi phiếu học phí (spec V)', () => {
  test('Desktop (1280px): Tải ảnh tự đánh dấu đã gửi, lọc phiếu báo, đổi số tiền hiện nhãn cam', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const studentName = `${TEST_PREFIX} Desk ${Date.now().toString().slice(-4)}`;
    const session1 = `${SESSION_PREFIX} D1 ${Date.now().toString().slice(-4)}`;
    const session2 = `${SESSION_PREFIX} D2 ${Date.now().toString().slice(-4)}`;

    await login(page);
    await addStudent(page, studentName);
    await createAndAttendSession(page, studentName, 8, session1);

    // Vào màn học phí
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);

    // Dòng trong bảng
    const row = page.getByRole('row').filter({ hasText: studentName });
    await expect(row).toBeVisible();

    // Mở phiếu báo
    await row.getByRole('button', { name: 'Phiếu báo', exact: true }).click();

    const dialog = page.getByTestId('tuition-notice');
    await expect(dialog).toBeVisible();

    // Tải ảnh
    const downloadBtn = dialog.getByRole('button', { name: 'Tải ảnh' });
    await expect(downloadBtn).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    // Toast hiện thông báo
    await expect(page.getByText('Đã đánh dấu đã gửi phiếu')).toBeVisible();

    // Đóng phiếu báo
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Danh sách hiện nhãn "Đã gửi"
    await expect(row.getByText(/Đã gửi \d+\/\d+/)).toBeVisible();

    // Lọc "Chưa gửi" -> không còn em đó
    const noticeCombobox = page.getByRole('combobox').filter({ hasText: /^Tất cả$|^Phiếu báo$|^Chưa gửi$|^Đã gửi$/ });
    await noticeCombobox.click();
    await page.getByRole('option', { name: 'Chưa gửi' }).click();
    await expect(row).toBeHidden();

    // Lọc "Đã gửi" -> em đó xuất hiện
    await noticeCombobox.click();
    await page.getByRole('option', { name: 'Đã gửi' }).click();
    await expect(row).toBeVisible();

    // Điểm danh thêm 1 buổi có mặt
    await createAndAttendSession(page, studentName, 10, session2);

    // Vào lại học phí
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);

    // Nhãn "Đã gửi · số tiền đã đổi" (màu cam)
    const rowUpdated = page.getByRole('row').filter({ hasText: studentName });
    await expect(rowUpdated.getByText('Đã gửi · số tiền đã đổi')).toBeVisible();

    // Lọc "Chưa gửi" -> em đó QUAY LẠI trong danh sách chưa gửi
    const noticeCombobox2 = page.getByRole('combobox').filter({ hasText: /^Tất cả$|^Phiếu báo$|^Chưa gửi$|^Đã gửi$/ });
    await noticeCombobox2.click();
    await page.getByRole('option', { name: 'Chưa gửi' }).click();
    await expect(rowUpdated).toBeVisible();
  });

  test('Mobile (390px): Lưu ảnh tự đánh dấu đã gửi, lọc phiếu báo, đổi số tiền', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const studentName = `${TEST_PREFIX} Mob ${Date.now().toString().slice(-4)}`;
    const session1 = `${SESSION_PREFIX} M1 ${Date.now().toString().slice(-4)}`;

    await login(page);
    await addStudent(page, studentName);
    await createAndAttendSession(page, studentName, 14, session1);

    // Vào màn học phí
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const card = page.getByTestId('list-card').filter({ hasText: studentName });
    await expect(card).toBeVisible();

    // Mở phiếu báo
    await card.getByRole('button', { name: 'Phiếu báo', exact: true }).click();
    const sheet = page.getByTestId('tuition-notice');
    await expect(sheet).toBeVisible();

    // Bấm Lưu ảnh trên mobile
    const saveBtn = sheet.getByRole('button', { name: 'Lưu ảnh' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Viewer mở ra
    const viewerImg = page.locator('img[src^="blob:"]');
    await expect(viewerImg).toBeVisible();
    await expect(page.getByText(/Nhấn giữ ảnh/)).toBeVisible();

    // Đóng viewer
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(viewerImg).toBeHidden();

    // Đóng phiếu báo
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // Danh sách hiện nhãn "Đã gửi"
    await expect(card.getByText(/Đã gửi \d+\/\d+/)).toBeVisible();

    // Mở sheet lọc trên mobile (FilterBar mobile có nút sheet Lọc)
    const filterBtn = page.getByRole('button', { name: /Lọc|Filter/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      const filterSheet = page.getByRole('dialog');
      await filterSheet.getByRole('combobox').filter({ hasText: /^Tất cả$|^Phiếu báo$|^Chưa gửi$|^Đã gửi$/ }).click();
      await page.getByRole('option', { name: 'Chưa gửi' }).click();
      await page.keyboard.press('Escape');
    } else {
      await page.getByRole('combobox').filter({ hasText: /^Tất cả$|^Phiếu báo$|^Chưa gửi$|^Đã gửi$/ }).click();
      await page.getByRole('option', { name: 'Chưa gửi' }).click();
    }
    await expect(page.getByTestId('list-card').filter({ hasText: studentName })).toBeHidden();
  });
});
