import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

// Bug prod (iPhone): ô "Tìm tên học sinh..." ở Học phí gửi 1 query cho mỗi ký tự.
test('Học phí: gõ "Minh" liên tục chỉ gửi 1 query tìm "Minh"', async ({ page }) => {
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

  await page.goto('/tuition');
  const input = page.getByPlaceholder('Tìm tên học sinh...');
  await expect(input).toBeVisible();

  const searches: string[] = [];
  page.on('request', (req) => {
    const url = decodeURIComponent(req.url());
    if (!url.includes('tuition.getMonthlyStatus')) return;
    const m = url.match(/"search":"([^"]*)"/);
    if (m) searches.push(m[1]);
  });

  await input.pressSequentially('Minh', { delay: 50 });
  await expect(input).toHaveValue('Minh');
  await expect.poll(() => searches, { timeout: 5000 }).toContain('Minh');
  await page.waitForTimeout(500);
  expect(searches).toEqual(['Minh']);
});
