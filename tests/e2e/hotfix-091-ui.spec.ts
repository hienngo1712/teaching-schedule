import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();

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

test.beforeAll(() => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
});

test('1280px: form Tạo ca dạy — Ngày dạy và Môn học thẳng hàng nhãn lẫn ô', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Môn học').waitFor();
  // Đo cả 4 phần tử trong cùng 1 khung hình: dialog còn đang chạy hiệu ứng mở thì đo lần lượt sẽ lệch giả.
  await page.waitForTimeout(400);
  const [dl, sl, db, sb] = await dialog.evaluate((el) => {
    const label = (t: string) => [...el.querySelectorAll('label')].find((l) => l.textContent?.trim() === t)!;
    const ctrl = (l: HTMLLabelElement) => document.getElementById(l.htmlFor)!;
    const d = label('Ngày dạy'), s = label('Môn học');
    return [d, s, ctrl(d), ctrl(s)].map((n) => { const r = n.getBoundingClientRect(); return { y: r.top, h: r.height }; });
  });
  expect(Math.abs(dl.y - sl.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(db.y - sb.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(db.h - sb.h)).toBeLessThanOrEqual(1);
});

test('1280px: danh sách HS — cột "Học phí", "400.000 đ/tháng" nằm 1 dòng', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const teacher = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  const stamp = Date.now();
  const st = await db.student.create({
    data: { userId: teacher.id, fullName: `HS Trọn tháng ${stamp}`, grade: 4, billingMode: 'monthly', monthlyFee: 400000, isActive: true },
  });
  try {
    await login(page);
    await page.goto('/students');
    await expect(page.getByRole('columnheader', { name: 'Học phí', exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Tìm tên học sinh...').fill(`HS Trọn tháng ${stamp}`);
    const cell = page.getByRole('row').filter({ hasText: `HS Trọn tháng ${stamp}` }).getByText('400.000');
    await expect(cell).toBeVisible();
    // 1 dòng ~20px; bị xuống dòng thì ~40px.
    expect((await cell.boundingBox())!.height).toBeLessThan(30);
  } finally {
    await db.student.delete({ where: { id: st.id } });
  }
});
