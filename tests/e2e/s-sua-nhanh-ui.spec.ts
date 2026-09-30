import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const T = (s: string) => new Date(`1970-01-01T${s}:00.000Z`);

let teacherId = 0;
let subjectId = 0;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function login(page: Page) {
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
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  const teacher = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  teacherId = teacher.id;
  const subject = await db.subject.findFirstOrThrow({ where: { userId: teacherId } });
  subjectId = subject.id;
});

test.describe('Plan S — Sửa nhanh UI (S1–S5)', () => {
  test('S5 (1280px): thẻ ca trên lịch tháng hiển thị Lớp 5', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    const stamp = Date.now();
    const studentName = `HS Lop 5 ${stamp}`;
    const today = dayjs().format('YYYY-MM-DD');

    // Tạo HS lớp 5
    const student = await db.student.create({
      data: {
        userId: teacherId,
        fullName: studentName,
        grade: 5,
        tuitionFee: 100000,
        isActive: true,
      },
    });

    // Tạo ca hôm nay có HS lớp 5
    const session = await db.teachingSession.create({
      data: {
        userId: teacherId,
        subjectId,
        sessionDate: D(today),
        startTime: T('04:00'),
        endTime: T('04:45'),
        title: `Ca test S5 ${stamp}`,
        sessionStudents: {
          create: [{ studentId: student.id, grade: 5 }],
        },
      },
    });

    try {
      await page.goto('/calendar');
      const card = page.getByRole('button').filter({ hasText: `Ca test S5 ${stamp}` });
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(card).toContainText('Lớp 5');
    } finally {
      await db.sessionStudent.deleteMany({ where: { sessionId: session.id } });
      await db.teachingSession.delete({ where: { id: session.id } });
      await db.student.delete({ where: { id: student.id } });
    }
  });

  test('S4 (1280px): mở chi tiết ca → thấy Ca 1/n → bấm Ca sau 2 lần → Ca 3/n → ArrowLeft → Ca 2/n', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    const stamp = Date.now();
    const today = dayjs().format('YYYY-MM-DD');

    // Tạo 3 ca trong hôm nay với giờ khác nhau
    const s1 = await db.teachingSession.create({
      data: {
        userId: teacherId,
        subjectId,
        sessionDate: D(today),
        startTime: T('06:00'),
        endTime: T('07:00'),
        title: `Ca điều hướng 1 ${stamp}`,
      },
    });
    const s2 = await db.teachingSession.create({
      data: {
        userId: teacherId,
        subjectId,
        sessionDate: D(today),
        startTime: T('07:30'),
        endTime: T('08:30'),
        title: `Ca điều hướng 2 ${stamp}`,
      },
    });
    const s3 = await db.teachingSession.create({
      data: {
        userId: teacherId,
        subjectId,
        sessionDate: D(today),
        startTime: T('09:00'),
        endTime: T('10:00'),
        title: `Ca điều hướng 3 ${stamp}`,
      },
    });

    try {
      await page.goto('/calendar');

      // Mở ca đầu tiên (s1)
      const card1 = page.getByRole('button').filter({ hasText: `Ca điều hướng 1 ${stamp}` }).first();
      await expect(card1).toBeVisible({ timeout: 15000 });
      await card1.click();

      const detailDialog = page.getByRole('dialog');
      await expect(detailDialog).toBeVisible();

      // Kiểm tra navbar
      const nextBtn = detailDialog.getByRole('button', { name: 'Ca sau' });
      const prevBtn = detailDialog.getByRole('button', { name: 'Ca trước' });
      await expect(nextBtn).toBeVisible();
      await expect(prevBtn).toBeVisible();

      // Hotfix 0.8.2: chuyển ca không được đóng/mở lại modal (nháy) hay hiện màn đang tải.
      await expect(detailDialog.getByText(`Ca điều hướng 1 ${stamp}`)).toBeVisible();
      // Chờ tải trước ca lân cận xong, để lần tải còn sót (vd danh sách học sinh) lộ ra.
      await page.waitForLoadState('networkidle');
      await detailDialog.evaluate((el) => {
        el.setAttribute('data-probe', '1');
        const w = window as unknown as { __sawLoading: boolean };
        w.__sawLoading = false;
        new MutationObserver(() => {
          if (/Đang tải chi tiết|Đang tải danh sách học sinh/.test(document.body.innerText)) w.__sawLoading = true;
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      });

      // Bấm Ca sau lần 1
      await nextBtn.click();
      await expect(detailDialog.getByText(`Ca điều hướng 2 ${stamp}`)).toBeVisible();

      // Bấm Ca sau lần 2
      await nextBtn.click();
      await expect(detailDialog.getByText(`Ca điều hướng 3 ${stamp}`)).toBeVisible();

      // Nhấn phím ArrowLeft để quay lại ca 2
      await page.keyboard.press('ArrowLeft');
      await expect(detailDialog.getByText(`Ca điều hướng 2 ${stamp}`)).toBeVisible();

      await expect(page.locator('[role="dialog"][data-probe="1"]')).toHaveCount(1);
      expect(await page.evaluate(() => (window as unknown as { __sawLoading: boolean }).__sawLoading)).toBe(false);

      await page.keyboard.press('Escape');
    } finally {
      await db.teachingSession.deleteMany({ where: { id: { in: [s1.id, s2.id, s3.id] } } });
    }
  });

  test('Hotfix 0.8.2: đang chờ tải ca mới thì nội dung ca cũ không thao tác được (kể cả bàn phím)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    const stamp = Date.now();
    const today = dayjs().format('YYYY-MM-DD');
    const mk = (h: string, e: string, n: number) =>
      db.teachingSession.create({
        data: { userId: teacherId, subjectId, sessionDate: D(today), startTime: T(h), endTime: T(e), title: `Ca chờ ${n} ${stamp}` },
      });
    const a = await mk('11:00', '11:30', 1);
    const b = await mk('11:40', '12:10', 2);
    const c = await mk('12:20', '12:50', 3);
    try {
      await page.goto('/calendar');
      await page.getByRole('button').filter({ hasText: `Ca chờ 1 ${stamp}` }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(`Ca chờ 1 ${stamp}`)).toBeVisible();
      // Ca 2 đã tải trước lúc mở; làm chậm các lần tải sau để ca 3 (tải trước khi sang ca 2) còn đang chờ.
      await page.route(/session\.getDetail/, async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.continue();
      });
      await dialog.getByRole('button', { name: 'Ca sau' }).click();
      await expect(dialog.getByText(`Ca chờ 2 ${stamp}`)).toBeVisible();
      await dialog.getByRole('button', { name: 'Ca sau' }).click();
      const busy = dialog.locator('[aria-busy="true"]');
      await expect(busy).toBeVisible();
      await expect(busy).toHaveAttribute('inert', '');
      await expect(dialog.getByText(`Ca chờ 3 ${stamp}`)).toBeVisible({ timeout: 15000 });
      await expect(dialog.locator('[inert]')).toHaveCount(0);
    } finally {
      await page.unroute(/session\.getDetail/);
      await db.teachingSession.deleteMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    }
  });

  test('S2 (390px): Cài đặt → combobox Ngân hàng → gõ vcb → chỉ 1 option Vietcombank → lưu thành công', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    await page.goto('/settings');
    const bankCombo = page.getByRole('combobox', { name: 'Ngân hàng' });
    await expect(bankCombo).toBeVisible({ timeout: 15000 });
    await bankCombo.click();

    const searchInput = page.getByPlaceholder('Tìm ngân hàng…');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('vcb');

    const options = page.getByRole('option');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('Vietcombank');
    await options.first().click();

    await page.getByLabel('Số tài khoản').fill('0011009876543');
    const holder = page.getByLabel('Tên chủ tài khoản');
    await holder.fill('nguyen van test');
    await holder.blur();

    const consentBox = page.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i });
    if (await consentBox.isVisible()) {
      await consentBox.click();
    }

    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu tài khoản ngân hàng')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('S3 (390px): mở phiếu báo học phí mobile → nút Lưu ảnh → hiện ảnh blob và dòng hướng dẫn', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      delete (Navigator.prototype as { share?: unknown }).share;
      delete (Navigator.prototype as { canShare?: unknown }).canShare;
    });
    await login(page);

    const stamp = Date.now();
    const studentName = `HS Phieu S3 ${stamp}`;
    const today = dayjs().format('YYYY-MM-DD');

    // Tạo HS
    const student = await db.student.create({
      data: {
        userId: teacherId,
        fullName: studentName,
        grade: 5,
        tuitionFee: 100000,
        isActive: true,
      },
    });

    // Tạo ca hôm nay và điểm danh có mặt
    const session = await db.teachingSession.create({
      data: {
        userId: teacherId,
        subjectId,
        sessionDate: D(today),
        startTime: T('22:00'),
        endTime: T('23:00'),
        title: `Ca S3 ${stamp}`,
        sessionStudents: {
          create: [{ studentId: student.id, grade: 5, attendance: 'present' }],
        },
      },
    });

    try {
      // Đến trang học phí
      await page.goto('/tuition');
      await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
      const card = page.getByTestId('list-card').filter({ hasText: studentName });
      await expect(card).toBeVisible({ timeout: 15000 });

      const noticeBtn = card.getByRole('button', { name: 'Phiếu báo', exact: true });
      await noticeBtn.click();

      const noticeDialog = page.getByTestId('tuition-notice');
      await expect(noticeDialog).toBeVisible();

      // Trên mobile: nút là "Lưu ảnh"
      const saveImgBtn = noticeDialog.getByRole('button', { name: 'Lưu ảnh' });
      await expect(saveImgBtn).toBeVisible();
      await expect(saveImgBtn).toBeEnabled({ timeout: 20000 });

      await saveImgBtn.click();

      // Màn xem ảnh hiện ra
      const img = page.locator('img[src^="blob:"]');
      await expect(img).toBeVisible();
      // toBeVisible vẫn qua khi phần tử lệch khỏi màn hình / ảnh hỏng: kiểm nằm trọn trong màn hình và ảnh tải được.
      await expect(img).toBeInViewport({ ratio: 1 });
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(page.getByText(/Nhấn giữ ảnh → chọn Lưu vào Ảnh/)).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Đóng' })).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalScroll(page);

      await page.getByRole('button', { name: 'Đóng' }).click();
    } finally {
      await db.sessionStudent.deleteMany({ where: { sessionId: session.id } });
      await db.teachingSession.delete({ where: { id: session.id } });
      await db.student.delete({ where: { id: student.id } });
    }
  });
});
