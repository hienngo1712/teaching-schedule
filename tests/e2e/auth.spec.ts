import { test, expect } from '@playwright/test';

test('redirect to /login when not authenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/.*login/);
});

test('login successfully and redirect to /dashboard', async ({ page }) => {
  await page.goto('/login');
  
  // Wait for the form to be ready
  await page.waitForSelector('input[name="username"]');
  
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: false })).toBeVisible();
});

test('logout successfully', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  
  // Click logout (it's in a dropdown)
  await page.click('button[aria-label="Mở menu tài khoản"]');
  await page.click('text=Đăng xuất');
  
  await expect(page).toHaveURL(/.*login/);
});
