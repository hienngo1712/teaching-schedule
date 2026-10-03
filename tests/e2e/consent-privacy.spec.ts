import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Spec O: đồng ý chia sẻ dữ liệu, chính sách, cảnh báo sao lưu', () => {
  test('/privacy mở được khi chưa đăng nhập, có đủ mục', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeVisible();
    await expect(page.getByText('Trước khi đăng ký, bạn nên biết')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
  });

  test('/login có link tới /privacy; /register bắt tick đồng ý và có gợi ý tên đăng nhập', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Chính sách bảo mật' })).toHaveAttribute('href', '/privacy');
    await page.goto('/register');
    await expect(page.getByText('Trước khi đăng ký, bạn nên biết')).toBeVisible();
    const full = page.getByRole('link', { name: /Đọc đầy đủ chính sách/ });
    await expect(full).toHaveAttribute('href', '/privacy');
    await expect(full).toHaveAttribute('target', '_blank');
    await expect(page.getByText('Không nên dùng số điện thoại làm tên đăng nhập.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng ký/ })).toBeDisabled();
    await page.locator('#register-consent').click();
    await expect(page.getByRole('button', { name: /Đăng ký/ })).toBeEnabled();
  });

  test('thêm HS: nút Thêm bị khoá tới khi tick ô đồng ý; ô đồng ý không có link rời form', async ({ page }) => {
    await login(page);
    await page.goto('/students');
    await page.click('text=Thêm học sinh');
    const name = `HS dong y ${Math.floor(Math.random() * 1_000_000)}`;
    await page.fill('input[id="fullName"]', name);
    const add = page.locator('button[type="submit"]:has-text("Thêm")');
    await expect(add).toBeDisabled();
    await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0);
    await page.getByRole('checkbox', { name: /đồng ý chia sẻ/i }).click();
    await expect(add).toBeEnabled();
    await add.click();
    await expect(page.locator('text=Đã thêm học sinh')).toBeVisible();
  });

  test('cài đặt ngân hàng: Lưu bị khoá tới khi tick', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    const save = page.getByRole('button', { name: 'Lưu' });
    await expect(save).toBeDisabled();
    await page.getByRole('checkbox', { name: /đồng ý chia sẻ/i }).click();
    await expect(save).toBeEnabled();
  });

  test('sao lưu: hiện cảnh báo trước khi tải', async ({ page }) => {
    await login(page);
    // Mở menu tài khoản theo cách của tests/e2e/backup.spec.ts.
    await page.getByRole('button', { name: /tài khoản|account/i }).first().click();
    await page.getByRole('menuitem', { name: 'Sao lưu dữ liệu' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('chưa mã hoá');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Tôi hiểu, tải xuống' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^SaoLuu_.*\.xlsx$/);
  });
});
