import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { RELEASES } from '../../src/lib/releases';

test.describe.configure({ mode: 'serial' });

const db = new PrismaClient();
const USER = 'tour_demo';

// Tài khoản mới tinh: chưa có học sinh, chưa có ca (để thử bước báo thiếu dữ liệu).
async function cleanup() {
  await db.loginAttempt.deleteMany({ where: { username: USER } });
  const u = await db.user.findUnique({ where: { username: USER } });
  if (!u) return;
  await db.sessionStudent.deleteMany({ where: { session: { userId: u.id } } });
  await db.teachingSession.deleteMany({ where: { userId: u.id } });
  await db.student.deleteMany({ where: { userId: u.id } });
  await db.subject.deleteMany({ where: { userId: u.id } });
  await db.user.delete({ where: { id: u.id } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  await db.user.create({
    data: {
      username: USER,
      passwordHash: await bcrypt.hash('teacher123', 4),
      fullName: 'Cô Tour',
      plan: 'pro',
      planExpiresAt: expires,
      lastSeenRelease: RELEASES[0].version,
      feedbackPromptAt: new Date(),
      onboardingDismissedAt: null,
      mustChangePassword: false,
    },
  });
});

test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

const popover = (page: Page) => page.locator('.driver-popover');

for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}px: tour Thêm học sinh đi vào trong hộp, bấm Tiếp không đóng hộp`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: vp });
    await login(page);
    await page.getByTestId('tour-button-student').first().click();
    await expect(page).toHaveURL(/\/students$/);
    await expect(popover(page)).toContainText('Thêm học sinh');
    // driver.css tải động vẫn áp dụng.
    await expect(popover(page)).toHaveCSS('position', 'fixed');
    await page.locator('[data-tour="student-add"]:visible').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toContainText('Họ tên và lớp');
    // Phím mũi tên khi focus không ở ô nhập: phải = Tiếp, trái = Quay lại.
    // Hộp tự trả focus về ô Họ tên; các ô kế (Lớp, Cách thu, Học phí) đều tự dùng mũi tên → focus nút đóng hộp.
    const closeBtn = page.getByRole('dialog', { name: 'Thêm học sinh', exact: true }).getByRole('button', { name: 'Close' });
    await closeBtn.focus();
    await page.keyboard.press('ArrowRight');
    await expect(popover(page)).toContainText('Cách thu học phí');
    await closeBtn.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(popover(page)).toContainText('Họ tên và lớp');
    // Người dùng tự làm đúng lời chỉ trong lúc tour chạy: chọn lớp (menu thả xuống nằm ngoài hộp) không được tắt tour.
    await page.locator('#fullName').fill('Bé Tour');
    await page.locator('#grade').click();
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await expect(page.locator('#grade')).toContainText('5');
    await expect(popover(page)).toContainText('Họ tên và lớp');
    await popover(page).locator('.driver-popover-next-btn').click();
    await expect(popover(page)).toContainText('Cách thu học phí');
    await page.locator('#tuitionFee').fill('200000');
    await expect(popover(page)).toContainText('Cách thu học phí');
    for (const title of ['Thông tin phụ huynh', 'Lưu học sinh']) {
      await popover(page).locator('.driver-popover-next-btn').click();
      await expect(dialog).toBeVisible();
      await expect(popover(page)).toContainText(title);
    }
    // "Tick ô đồng ý rồi bấm Thêm": ô đồng ý phải nằm trong vùng tô sáng.
    await page.locator('#student-consent').click();
    await expect(page.locator('#student-consent')).toHaveAttribute('data-state', 'checked');
    await expect(popover(page)).toContainText('Lưu học sinh');
    await expect(popover(page).locator('.driver-popover-close-btn')).toHaveCSS('height', vp.width < 768 ? '44px' : '36px');
    await expect(popover(page).locator('.driver-popover-next-btn')).toHaveText('Xong');
    await popover(page).locator('.driver-popover-next-btn').click();
    await expect(page.locator('.driver-overlay')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
    await page.close();
  });
}

test('Điểm danh khi chưa có ca: bước báo thiếu → chuyển sang tour Tạo ca dạy', async ({ page }) => {
  await login(page);
  await page.getByTestId('tour-button-attendance').first().click();
  await expect(popover(page)).toContainText('Chưa có ca dạy');
  await popover(page).getByRole('button', { name: 'Chỉ cách tạo ca' }).click();
  await expect(popover(page)).toContainText('Tạo ca dạy');
  await expect(page.locator('[data-tour="session-add"]:visible')).toBeVisible();
});

test('Esc tắt tour sạch, không còn lớp phủ; tải lại không chạy lại', async ({ page }) => {
  await login(page);
  await page.goto('/settings?tour=bank');
  await expect(popover(page)).toContainText('Ngân hàng');
  await expect(page).toHaveURL(/\/settings$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.driver-overlay')).toHaveCount(0);
  await expect(popover(page)).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(popover(page)).toHaveCount(0);
});

test('/guide: chưa đăng nhập không có nút; giáo viên đăng nhập có 6 nút', async ({ browser }) => {
  const guest = await browser.newPage();
  await guest.goto('/guide');
  await expect(guest.locator('section#hoc-sinh')).toBeVisible();
  await expect(guest.getByRole('link', { name: 'Chỉ cho tôi' })).toHaveCount(0);
  await guest.close();
  const page = await browser.newPage();
  await login(page);
  await page.goto('/guide');
  await expect(page.getByRole('link', { name: 'Chỉ cho tôi' })).toHaveCount(6);
  await page.close();
});

test('390px: tour Điểm danh, bước chuyển ca: hộp chi tiết ca vẫn cuộn được', async ({ browser }) => {
  // 2 ca cùng tháng (giờ VN) để có thanh chuyển ca; ca hôm nay đứng đầu danh sách mobile.
  const u = await db.user.findUniqueOrThrow({ where: { username: USER } });
  const subject = await db.subject.create({ data: { userId: u.id, name: 'Toán', isDefault: true } });
  const student = await db.student.create({ data: { userId: u.id, fullName: 'Bé Cuộn', grade: 5, tuitionFee: 100000 } });
  const vn = new Date(Date.now() + 7 * 3600_000);
  const day = vn.getUTCDate();
  const ymd = (d: number) => new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), d));
  const T = (s: string) => new Date(`1970-01-01T${s}:00.000Z`);
  for (const d of [day, day > 1 ? day - 1 : day + 1]) {
    await db.teachingSession.create({
      data: {
        userId: u.id, subjectId: subject.id, sessionDate: ymd(d), startTime: T('10:00'), endTime: T('11:00'),
        sessionStudents: { create: { studentId: student.id, grade: 5, fee: 100000 } },
      },
    });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(page);
  await page.goto('/calendar?tour=attendance');
  await expect(popover(page)).toContainText('Mở ca dạy');
  await page.locator('[data-tour="session-card"]:visible').first().click();
  await expect(popover(page)).toContainText('Sang ca khác');
  // Popover tour cũng là role=dialog → chọn hộp Radix theo data-state.
  const dlg = page.locator('[role="dialog"][data-state="open"]');
  await expect(dlg).toHaveCSS('overflow-y', 'auto');
  await page.close();
  // Trả lại tài khoản không có ca cho các lần chạy sau.
  await db.sessionStudent.deleteMany({ where: { session: { userId: u.id } } });
  await db.teachingSession.deleteMany({ where: { userId: u.id } });
});
