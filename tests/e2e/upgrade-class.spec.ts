import { test, expect } from '@playwright/test';

test.describe('Class Upgrade flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('manual upgrade button is visible and either fires or stays disabled', async ({ page }) => {
    await page.goto('/students');

    const upgradeBtn = page.getByRole('button', {
      name: /nâng lớp hàng loạt|bulk grade up/i,
    });
    await expect(upgradeBtn).toBeVisible();

    // If already upgraded this year, button must be disabled — skip the flow.
    if (await upgradeBtn.isDisabled()) {
      test.skip(true, 'Already upgraded this year — skipping manual flow');
      return;
    }

    await upgradeBtn.click();

    await expect(
      page.getByText(/nâng lớp toàn bộ học sinh|upgrade all students/i),
    ).toBeVisible();

    await page
      .getByRole('button', { name: /xác nhận|confirm/i })
      .click();

    await expect(
      page.getByText(/đã nâng lớp|upgraded/i),
    ).toBeVisible({ timeout: 10000 });

    await expect(upgradeBtn).toBeDisabled();
  });
});
