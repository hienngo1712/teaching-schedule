import { test, expect, type Page } from '@playwright/test';

async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
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

for (const width of [1280, 390]) {
  test(`dọn tab Học sinh ở ${width}px: popup cảnh báo → HS biến khỏi Thùng rác`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    const name = `E2E Dọn ${width}-${Math.floor(Math.random() * 100_000)}`;
    const st = await trpcMutation<{ id: number }>(page, 'student.create', { fullName: name, grade: 3 });
    await trpcMutation(page, 'student.delete', { id: st.id });

    await page.goto('/trash');
    await page.getByRole('tab', { name: /Học sinh/ }).click();
    await expect(page.getByText(name).filter({ visible: true })).toBeVisible();
    const purgeBtn = page.getByRole('button', { name: /Dọn tab này/ });
    const box = await purgeBtn.boundingBox();
    if (width === 390) expect(box!.height).toBeGreaterThanOrEqual(44);
    await purgeBtn.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/vĩnh viễn không lấy lại được/)).toBeVisible();
    await expect(dialog.getByText(/vẫn được giữ trong Báo cáo/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Xóa vĩnh viễn' }).click();
    await expect(page.getByText(/Đã dọn \d+ mục/)).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
