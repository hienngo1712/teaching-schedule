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
    await page.goto('/students?tour=student');
    await expect(page).toHaveURL(/\/students$/);
    await expect(popover(page)).toContainText('Thêm học sinh');
    await page.locator('[data-tour="student-add"]:visible').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toContainText('Họ tên và lớp');
    for (const title of ['Cách thu học phí', 'Thông tin phụ huynh', 'Lưu học sinh']) {
      await popover(page).locator('.driver-popover-next-btn').click();
      await expect(dialog).toBeVisible();
      await expect(popover(page)).toContainText(title);
    }
    await expect(popover(page).locator('.driver-popover-next-btn')).toHaveText('Xong');
    await popover(page).locator('.driver-popover-next-btn').click();
    await expect(page.locator('.driver-overlay')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
    await page.close();
  });
}
