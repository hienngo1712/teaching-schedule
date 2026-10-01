import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hardDeleteStudents, studentIdsByNamePrefix } from './helpers/db-cleanup';

const db = new PrismaClient();

const TEST_PREFIX = 'HS Trọn Tháng E2E';
const SESSION_PREFIX = 'Ca Trọn Tháng E2E';

async function cleanupData() {
  await db.sessionStudent.deleteMany({
    where: { session: { title: { startsWith: SESSION_PREFIX } } },
  });
  await db.teachingSession.deleteMany({
    where: { title: { startsWith: SESSION_PREFIX } },
  });
  // Tên đã mã hoá: lọc sau khi giải mã; FK cascade dọn lịch sử cách thu/học phí.
  await hardDeleteStudents(db, await studentIdsByNamePrefix(db, TEST_PREFIX));
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

async function addMonthlyStudent(page: Page, studentName: string) {
  await page.goto('/students');
  await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Họ và tên/i).fill(studentName);

  await dialog.locator('button#grade').click();
  await page.getByRole('option', { name: 'Lớp 5' }).click();

  // Chọn cách thu: Trọn tháng
  await dialog.getByRole('radio', { name: /Trọn tháng/i }).click();
  await dialog.locator('input#monthlyFee').fill('400000');

  // Tick đồng ý
  await dialog.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();

  // Bấm Thêm
  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await expect(page.getByText('Đã thêm học sinh')).toBeVisible();
}

async function createAndAttendSession(
  page: Page,
  studentName: string,
  startHour: number,
  title: string,
  attendance: 'Có mặt' | 'Vắng'
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
  await detail.getByRole('button', { name: attendance }).first().click();
  await detail.getByRole('button', { name: 'Lưu điểm danh' }).click();
  await expect(page.getByText('Đã lưu điểm danh').first()).toBeVisible();
  await page.keyboard.press('Escape');
}

test.describe('Học phí trọn tháng E2E', () => {
  test('Quy trình học phí trọn tháng trên mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const studentName = `${TEST_PREFIX} M${Date.now().toString().slice(-4)}`;
    const session1 = `${SESSION_PREFIX} 1 M${Date.now().toString().slice(-4)}`;
    const session2 = `${SESSION_PREFIX} 2 M${Date.now().toString().slice(-4)}`;

    await login(page);

    // 1. Thêm HS "Trọn tháng" 400.000
    await addMonthlyStudent(page, studentName);

    // 2. Danh sách hiện 400.000 đ/tháng
    await page.goto('/students');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const studentCard = page.getByTestId('list-card').filter({ hasText: studentName });
    await expect(studentCard).toBeVisible();
    await expect(studentCard).toContainText(/400\.000\s*(?:đ|\u20ab)?\/tháng/);

    // 3. Tạo 2 ca hôm nay có HS: ca 1 Có mặt, ca 2 Vắng
    await createAndAttendSession(page, studentName, 8, session1, 'Có mặt');
    await createAndAttendSession(page, studentName, 10, session2, 'Vắng');

    // 4. Màn Học phí tháng này: thẻ HS hiện 400.000 và "1/2"
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const tuitionCard = page.getByTestId('list-card').filter({ hasText: studentName });
    await expect(tuitionCard).toBeVisible();
    await expect(tuitionCard).toContainText('400.000');
    await expect(tuitionCard).toContainText('1/2');

    // 5. Mở phiếu báo: có "trọn gói"
    const noticeBtn = tuitionCard.getByRole('button', { name: 'Phiếu báo', exact: true });
    await expect(noticeBtn).toBeVisible();
    await noticeBtn.click();

    const noticeDialog = page.getByRole('dialog');
    await expect(noticeDialog).toBeVisible();
    await expect(noticeDialog).toContainText(/trọn gói/i);
    await expect(noticeDialog).toContainText('400.000');
    await expect(noticeDialog).toContainText('1/2');
    await page.keyboard.press('Escape');
  });

  test('Quy trình học phí trọn tháng trên desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const studentName = `${TEST_PREFIX} D${Date.now().toString().slice(-4)}`;
    const session1 = `${SESSION_PREFIX} 1 D${Date.now().toString().slice(-4)}`;
    const session2 = `${SESSION_PREFIX} 2 D${Date.now().toString().slice(-4)}`;

    await login(page);

    // 1. Thêm HS "Trọn tháng" 400.000
    await addMonthlyStudent(page, studentName);

    // 2. Danh sách bảng desktop hiện 400.000 đ/tháng
    await page.goto('/students');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const tableRow = page.locator('tbody tr', { hasText: studentName });
    await expect(tableRow).toBeVisible();
    await expect(tableRow).toContainText(/400\.000\s*(?:đ|\u20ab)?\/tháng/);

    // 3. Tạo 2 ca hôm nay có HS: ca 1 Có mặt, ca 2 Vắng
    await createAndAttendSession(page, studentName, 13, session1, 'Có mặt');
    await createAndAttendSession(page, studentName, 15, session2, 'Vắng');

    // 4. Màn Học phí tháng này: dòng/thẻ HS hiện 400.000 và "1/2"
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const rowOrCard = page.locator('tr, [data-testid="list-card"]', { hasText: studentName }).first();
    await expect(rowOrCard).toBeVisible();
    await expect(rowOrCard).toContainText('400.000');
    await expect(rowOrCard).toContainText('1/2');

    // 5. Mở phiếu báo: có "trọn gói"
    const noticeBtn = rowOrCard.getByRole('button', { name: 'Phiếu báo', exact: true });
    await expect(noticeBtn).toBeVisible();
    await noticeBtn.click();

    const noticeDialog = page.getByRole('dialog');
    await expect(noticeDialog).toBeVisible();
    await expect(noticeDialog).toContainText(/trọn gói/i);
    await expect(noticeDialog).toContainText('400.000');
    await expect(noticeDialog).toContainText('1/2');
    await page.keyboard.press('Escape');
  });
});
