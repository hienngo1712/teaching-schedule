import { test, expect, type Browser, type Page } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function openAccounts(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await page.goto('/admin/accounts');
  await expect(page.getByRole('heading', { level: 1, name: 'Tài khoản & gói' })).toBeVisible();
  return page;
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('1280px: cột Hành động gọn, tiêu đề 1 dòng, bảng không tràn; menu → dialog → Hủy không kẹt trang (spec P9)', async ({ browser }) => {
  const page = await openAccounts(browser, DESKTOP);
  // DB test chỉ có seed + vài user e2e; nhiều hơn 20 thì dòng mục tiêu có thể sang trang 2.
  expect(await page.getByRole('row').count()).toBeLessThanOrEqual(21);

  const ref = (await page.getByRole('columnheader', { name: 'Gói', exact: true }).boundingBox())!.height;
  for (const name of ['Tên đăng nhập', 'Đăng nhập cuối', 'HS đang học', 'Hành động']) {
    expect((await page.getByRole('columnheader', { name }).boundingBox())!.height, name).toBeLessThanOrEqual(ref + 1);
  }
  const tableOverflow = await page.locator('table').evaluate((t) => t.scrollWidth - (t.parentElement?.clientWidth ?? t.scrollWidth));
  expect(tableOverflow).toBeLessThanOrEqual(0);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  const row = page.getByRole('row').filter({ hasText: 'teacher_std' });
  await row.getByRole('button', { name: 'Menu hành động teacher_std' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Đặt gói', 'Đặt dùng thử', 'Reset mật khẩu']);
  await page.getByRole('menuitem', { name: 'Đặt gói' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('teacher_std');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.body.style.pointerEvents)).not.toBe('none');

  await page.getByRole('row').filter({ hasText: 'admin_test' }).getByRole('button', { name: 'Menu hành động admin_test' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Đặt gói']);
  await page.keyboard.press('Escape');
  await page.context().close();
});

test('390px: nút Hành động ≥44px ở góc thẻ, mục menu ≥44px, Reset mật khẩu → Hủy, không tràn ngang (spec P9)', async ({ browser }) => {
  const page = await openAccounts(browser, MOBILE);
  const card = page.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' });
  const btn = card.getByRole('button', { name: 'Menu hành động teacher_std' });
  const b = (await btn.boundingBox())!;
  const c = (await card.boundingBox())!;
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);
  expect(b.y - c.y).toBeLessThan(24);

  await btn.click();
  const menu = page.getByRole('menu');
  await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  for (const item of await page.getByRole('menuitem').all()) {
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('menuitem', { name: 'Reset mật khẩu' }).click();
  const dlg = page.getByRole('alertdialog');
  await dlg.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  expect((await dlg.getByRole('button', { name: 'Hủy', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dlg).toBeHidden();
  expect(await page.evaluate(() => document.body.style.pointerEvents)).not.toBe('none');

  // Thẻ cuối không bị thanh phân trang che.
  await page.locator('main').evaluate((m) => m.scrollTo(0, m.scrollHeight));
  const last = (await page.getByTestId('admin-user-card').last().boundingBox())!;
  const next = (await page.getByRole('button', { name: 'Trang sau' }).boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(next.y);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});
