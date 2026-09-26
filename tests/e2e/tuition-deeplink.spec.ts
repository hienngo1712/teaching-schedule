import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

// Gọi tRPC qua HTTP bằng cookie đăng nhập của page → ghi vào DB test mà dev server đang dùng.
async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

test.describe('Deep link Học phí (?studentId=) khi HS đích nằm ngoài trang 1', () => {
  const createdStudentIds: number[] = [];

  test.beforeEach(async ({ page }) => {
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

  test.afterEach(async ({ page }) => {
    for (const id of createdStudentIds.splice(0)) await trpcMutation(page, 'student.delete', { id });
  });

  test('HS tên ngắn khớp chuỗi con với >20 HS khác → deep link vẫn mở đúng sheet', async ({ page }) => {
    const stamp = Date.now();
    const shortName = `E2EDL${stamp}`; // tên đích, cũng là chuỗi tìm kiếm (giống link thật từ Dashboard)

    // 25 HS khác cùng lớp, tên chứa shortName làm chuỗi con, sắp xếp alphabet TRƯỚC HS đích
    // ("0" < các chữ cái) → chiếm hết trang 1 (20 dòng), đẩy HS đích sang trang 2.
    for (let i = 0; i < 25; i++) {
      const s = await trpcMutation<{ id: number }>(page, 'student.create', {
        fullName: `0${shortName} hs${i}`,
        grade: 1,
      });
      createdStudentIds.push(s.id);
    }

    const target = await trpcMutation<{ id: number }>(page, 'student.create', {
      fullName: shortName,
      grade: 1,
    });
    createdStudentIds.push(target.id);

    const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // giờ VN
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const url = `/tuition?${new URLSearchParams({
      year: String(year),
      month: String(month),
      studentName: shortName,
      studentId: String(target.id),
    })}`;
    await page.goto(url);

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(shortName);
  });
});
