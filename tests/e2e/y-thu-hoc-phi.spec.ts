import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { vnDateParts } from '@/lib/utils';
import { keyToYearMonth } from '@/lib/payment-allocation';
import { monthKey } from '@/lib/billing';

test.use({ viewport: { width: 1280, height: 800 } });

const db = new PrismaClient();

async function clean() {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  const students = await db.student.findMany({
    where: { userId: user.id, fullName: { startsWith: 'E2E Y ' } },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);
  if (studentIds.length > 0) {
    await db.payment.deleteMany({ where: { monthlyTuition: { studentId: { in: studentIds } } } });
    await db.monthlyTuition.deleteMany({ where: { studentId: { in: studentIds } } });
    await db.sessionStudent.deleteMany({ where: { studentId: { in: studentIds } } });
    await db.studentBillingChange.deleteMany({ where: { studentId: { in: studentIds } } });
    await db.student.deleteMany({ where: { id: { in: studentIds } } });
  }
}

test.describe('E2E Luồng thu học phí mới (spec Y Task 8)', () => {
  test.beforeEach(clean);
  test.afterAll(clean);

  test('Vào /tuition xem tháng trước, Đã đóng đủ 1 chạm, thu đa tháng FIFO, hoàn tác', async ({ page }) => {
    const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
    const subject = await db.subject.findFirstOrThrow({ where: { userId: user.id, isActive: true } });

    const nowVn = vnDateParts();
    const curK = monthKey(nowVn.year, nowVn.month);
    const m1 = keyToYearMonth(curK - 2);
    const m2 = keyToYearMonth(curK - 1);
    const m3 = { year: nowVn.year, month: nowVn.month };

    // 1. Dựng E2E Y An: theo buổi 100k, tháng trước m2 có 8 buổi có mặt (800k)
    const stAn = await db.student.create({
      data: { userId: user.id, fullName: 'E2E Y An', grade: 5, tuitionFee: 100000 },
    });
    for (let day = 1; day <= 8; day++) {
      const dateStr = `${m2.year}-${String(m2.month).padStart(2, '0')}-${String(day * 2).padStart(2, '0')}`;
      await db.teachingSession.create({
        data: {
          userId: user.id,
          subjectId: subject.id,
          sessionDate: new Date(`${dateStr}T00:00:00Z`),
          startTime: new Date('1970-01-01T08:00:00Z'),
          endTime: new Date('1970-01-01T09:30:00Z'),
          sessionStudents: { create: { studentId: stAn.id, attendance: 'present', fee: 100000, grade: 5 } },
        },
      });
    }

    // 2. Dựng E2E Y Huy: nợ m1 200k + m2 600k (tổng 800k)
    const stHuy = await db.student.create({
      data: { userId: user.id, fullName: 'E2E Y Huy', grade: 6, tuitionFee: 100000 },
    });
    // m1: 2 buổi
    for (let day = 1; day <= 2; day++) {
      const dateStr = `${m1.year}-${String(m1.month).padStart(2, '0')}-${String(day * 2).padStart(2, '0')}`;
      await db.teachingSession.create({
        data: {
          userId: user.id,
          subjectId: subject.id,
          sessionDate: new Date(`${dateStr}T00:00:00Z`),
          startTime: new Date('1970-01-01T08:00:00Z'),
          endTime: new Date('1970-01-01T09:30:00Z'),
          sessionStudents: { create: { studentId: stHuy.id, attendance: 'present', fee: 100000, grade: 6 } },
        },
      });
    }
    // m2: 6 buổi
    for (let day = 1; day <= 6; day++) {
      const dateStr = `${m2.year}-${String(m2.month).padStart(2, '0')}-${String(day * 4).padStart(2, '0')}`;
      await db.teachingSession.create({
        data: {
          userId: user.id,
          subjectId: subject.id,
          sessionDate: new Date(`${dateStr}T00:00:00Z`),
          startTime: new Date('1970-01-01T08:00:00Z'),
          endTime: new Date('1970-01-01T09:30:00Z'),
          sessionStudents: { create: { studentId: stHuy.id, attendance: 'present', fee: 100000, grade: 6 } },
        },
      });
    }

    // Đăng nhập
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // 1. Vào /tuition (không params) -> mặc định tháng trước m2
    await page.goto('/tuition');
    await expect(page.getByText('Đang xem tháng trước để chốt học phí.')).toBeVisible();
    await expect(page.getByText(`Tháng ${m2.month} / ${m2.year}`)).toBeVisible();

    // 2. Luồng 1: E2E Y An -> bấm Đã đóng đủ 800.000 đ -> toast -> hoàn tác
    const rowAn = page.locator('tr').filter({ hasText: 'E2E Y An' });
    await expect(rowAn).toBeVisible();
    const payFullBtnAn = rowAn.getByRole('button', { name: 'Đã đóng đủ 800.000 đ' });
    await expect(payFullBtnAn).toBeVisible();
    await payFullBtnAn.click();
    await expect(page.getByText(/Đã ghi 800\.000/)).toBeVisible();
    // Sau khi đóng đủ thì nút không còn trên dòng
    await expect(rowAn.getByRole('button', { name: /Đã đóng đủ/ })).toHaveCount(0);

    // Bấm Hoàn tác trên toast
    const undoBtn = page.getByRole('button', { name: 'Hoàn tác' });
    await undoBtn.click();
    // Nút Đã đóng đủ xuất hiện trở lại
    await expect(rowAn.getByRole('button', { name: 'Đã đóng đủ 800.000 đ' })).toBeVisible();

    // 3. Luồng 2: Mở chi tiết E2E Y Huy -> Đóng một phần 500k -> xem trước chia tiền
    const rowHuy = page.locator('tr').filter({ hasText: 'E2E Y Huy' });
    await rowHuy.click();
    const sheet = page.getByRole('dialog', { name: 'Chi tiết học phí' });
    await expect(sheet).toBeVisible();

    // Không có checkbox Đánh dấu đã đóng đủ
    await expect(sheet.getByRole('checkbox')).toHaveCount(0);
    // Không có chữ Chuyển khoản trong sheet
    await expect(sheet.getByText('Chuyển khoản')).toHaveCount(0);

    await sheet.getByRole('button', { name: 'Đóng một phần' }).click();
    await sheet.getByLabel('Số tiền phụ huynh đưa').fill('500000');
    // Xem trước trừ vào T<m1> 200k, T<m2> 300k
    await expect(sheet.getByText(new RegExp(`Trừ vào T${m1.month}:.*200\\.000.*T${m2.month}:.*300\\.000`))).toBeVisible();
    await sheet.getByRole('button', { name: 'Ghi nhận' }).click();
    await expect(page.getByText(/Đã ghi 500\.000/)).toBeVisible();

    // Sau khi thu 500k: còn thiếu 300.000 đ
    await expect(sheet.getByTestId('remaining-line')).toHaveText('300.000 đ');
    await page.keyboard.press('Escape');

    // 4. Luồng 3: Sang tháng hiện tại (m3)
    await page.getByRole('button', { name: `Xem tháng ${m3.month}` }).click();
    await expect(page.getByText('Tháng đang học: tiền buổi chỉ tạm tính.')).toBeVisible();

    // Mở chi tiết E2E Y Huy ở tháng m3
    const rowHuyM3 = page.locator('tr').filter({ hasText: 'E2E Y Huy' });
    await rowHuyM3.click();
    // Thấy dòng Tháng <m2> còn thiếu 300.000 đ
    await expect(sheet.getByText(`Tháng ${m2.month} còn thiếu`)).toBeVisible();
    // Tháng đang học không thu tiền: không có nút thu, có dòng nhắc + nút sang tháng đã học xong
    await expect(rowHuyM3.getByRole('button', { name: /Đã đóng đủ/ })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: /^Đã đóng đủ/ })).toHaveCount(0);
    await expect(sheet.getByTestId('pay-month-in-progress')).toContainText(`Tháng ${m3.month} chưa học xong`);
    await sheet.getByRole('button', { name: `Sang tháng ${m2.month}` }).click();
    await expect(page).toHaveURL(new RegExp(`month=${m2.month}`));
    // Sheet mở lại đúng HS ở tháng m2 → thu nốt 300k
    await expect(sheet.getByText('E2E Y Huy')).toBeVisible();
    await sheet.getByRole('button', { name: 'Đã đóng đủ 300.000 đ' }).click();
    await expect(page.getByText(/Đã ghi 300\.000/)).toBeVisible();
    await page.keyboard.press('Escape');

    // Quay lại tháng m2 kiểm tra E2E Y Huy đã có badge Đã đóng đủ
    await page.goto(`/tuition?year=${m2.year}&month=${m2.month}`);
    const rowHuyFinished = page.locator('tr').filter({ hasText: 'E2E Y Huy' });
    await expect(rowHuyFinished.getByText('Đã đóng đủ')).toBeVisible();
  });
});
