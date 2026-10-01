import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const ids: number[] = [];

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
  for (let i = 0; i < 24; i++) {
    const st = await db.student.create({ data: { userId: teacher.id, fullName: `HS Khoảng trắng ${i}`, grade: 1 + (i % 12), isActive: true } });
    ids.push(st.id);
  }
});

test.afterAll(async () => {
  await db.student.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

test('1280px: form Tạo ca dạy nhiều HS — cuộn xuống không có khoảng trắng dưới nút', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('HS Khoảng trắng 0', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(400);
  const gap = await dialog.evaluate((el) => {
    const btns = [...el.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Tạo ca dạy');
    const footer = btns[btns.length - 1].parentElement!;
    const contentBottom = footer.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop;
    return el.scrollHeight - contentBottom;
  });
  // Chỉ còn padding dưới của hộp (~24px); khoảng trắng lớn = phần tử ẩn lọt ra ngoài khung danh sách HS.
  expect(gap).toBeLessThanOrEqual(40);
});
