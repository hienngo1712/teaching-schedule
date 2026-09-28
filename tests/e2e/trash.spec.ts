import { test, expect, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

async function trpcQuery<T>(page: Page, path: string, input?: unknown): Promise<T> {
  const query = input !== undefined ? `?input=${encodeURIComponent(JSON.stringify(input))}` : '';
  const res = await page.request.get(`/api/trpc/${path}${query}`);
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

async function loginTeacher(page: Page) {
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

test.describe('Thùng rác & Xoá mềm (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await loginTeacher(page);
  });

  test('1. Desktop 1280px: tạo HS qua UI → xoá HS → vào /trash khôi phục → xuất hiện lại trong /students', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const name = `E2E Rác ${Math.floor(Math.random() * 1_000_000)}`;

    await page.goto('/students');
    await page.click('text=Thêm học sinh');
    await page.fill('input[id="fullName"]', name);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.locator('button:has-text("Thêm")').last().click();

    await expect(page.locator('text=Đã thêm học sinh')).toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();

    // Xoá HS
    await page.click(`tr:has-text("${name}") button:has(svg)`);
    await page.getByRole('menuitem', { name: 'Xóa', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.locator('text=Đã chuyển học sinh vào Thùng rác')).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);

    // Vào sidebar Thùng rác -> /trash
    await page.getByRole('link', { name: 'Thùng rác' }).click();
    await expect(page).toHaveURL(/\/trash/);

    // Bấm tab Học sinh
    await page.getByRole('tab', { name: /Học sinh/ }).click();
    const row = page.locator('tr', { hasText: name });
    await expect(row).toBeVisible();

    // Bấm Khôi phục
    await row.getByRole('button', { name: 'Khôi phục' }).click();
    await expect(page.locator('text=Đã khôi phục')).toBeVisible();

    // Kiểm tra xuất hiện lại trong /students
    await page.goto('/students');
    await expect(page.getByRole('cell', { name })).toBeVisible();

    // Dọn dẹp qua API
    const studentsRes = await trpcQuery<{ items: { id: number; fullName: string }[] }>(page, 'student.list', { status: 'all' });
    const created = studentsRes.items.find((s) => s.fullName === name);
    if (created) {
      await trpcMutation(page, 'student.delete', { id: created.id });
    }
  });

  test('2. Mobile 390px: tạo ca qua API → xoá ca trên lịch → vào Thêm > Thùng rác khôi phục (≥44px, không tràn ngang)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const stamp = Math.floor(Math.random() * 100_000);
    const title = `E2E Ca rác ${stamp}`;
    const subjectList = await trpcQuery<{ items: { id: number; isDefault: boolean }[] }>(page, 'subject.list');
    const subjectId = (subjectList.items.find((s) => s.isDefault) ?? subjectList.items[0]).id;

    // Tạo ca tương lai
    const session = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: '2031-10-15',
      startTime: '10:00',
      endTime: '11:00',
      subjectId,
      title,
    });

    // Mở lịch và xoá ca
    await page.goto('/calendar?view=month&date=2031-10-01');
    await page.getByText(title).filter({ visible: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
    await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();

    // Vào tab Thêm -> Thùng rác
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Thêm' }).getByRole('link', { name: /Thùng rác/ }).click();
    await expect(page).toHaveURL(/\/trash/);

    // Tab Ca dạy (mặc định) có card
    const card = page.getByTestId('trash-card').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Nút Khôi phục cao >= 44px
    const restoreBtn = card.getByRole('button', { name: 'Khôi phục' });
    const box = await restoreBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // Bấm Khôi phục
    await restoreBtn.click();
    await expect(page.getByText('Đã khôi phục')).toBeVisible();

    // Dọn dẹp
    await trpcMutation(page, 'session.delete', { id: session.id });
  });

  test('3. Xung đột ca: khôi phục ca trùng giờ báo lỗi và ca vẫn trong Thùng rác', async ({ page }) => {
    const stamp = Math.floor(Math.random() * 100_000);
    const titleA = `Ca A trùng ${stamp}`;
    const titleB = `Ca B trùng ${stamp}`;
    const subjectList = await trpcQuery<{ items: { id: number; isDefault: boolean }[] }>(page, 'subject.list');
    const subjectId = (subjectList.items.find((s) => s.isDefault) ?? subjectList.items[0]).id;
    const sessionDate = '2031-11-20';

    // Tạo ca A 08:00–09:00, xoá A
    const a = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate,
      startTime: '08:00',
      endTime: '09:00',
      subjectId,
      title: titleA,
    });
    await trpcMutation(page, 'session.delete', { id: a.id });

    // Tạo ca B 08:30–09:30 cùng ngày
    const b = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate,
      startTime: '08:30',
      endTime: '09:30',
      subjectId,
      title: titleB,
    });

    // Vào /trash khôi phục A -> báo lỗi trùng giờ
    await page.goto('/trash');
    const cardA = page.locator('[data-testid="trash-card"], tr').filter({ hasText: titleA });
    await expect(cardA.first()).toBeVisible();
    await cardA.first().getByRole('button', { name: 'Khôi phục' }).click();
    await expect(page.getByText(/Trùng giờ/)).toBeVisible();

    // A vẫn còn trong Thùng rác
    await expect(cardA.first()).toBeVisible();

    // Dọn dẹp
    await trpcMutation(page, 'session.delete', { id: b.id });
  });

  test('4. HS còn nợ: cảnh báo nợ, Cho nghỉ thay chuyển sang Đã nghỉ, bấm Xoá tiếp vào Thùng rác', async ({ page }) => {
    const stamp = Math.floor(Math.random() * 100_000);
    const nameDebt = `E2E Nợ ${stamp}`;
    const subjectList = await trpcQuery<{ items: { id: number; isDefault: boolean }[] }>(page, 'subject.list');
    const subjectId = (subjectList.items.find((s) => s.isDefault) ?? subjectList.items[0]).id;

    // Tạo HS có học phí 100.000
    const st = await trpcMutation<{ id: number }>(page, 'student.create', {
      fullName: nameDebt,
      grade: 6,
      defaultTuitionFee: 100_000,
    });

    // Tạo ca hôm nay theo giờ VN và điểm danh present
    const vnToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const sess = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: vnToday,
      startTime: '19:00',
      endTime: '20:00',
      subjectId,
      studentIds: [st.id],
    });
    await trpcMutation(page, 'attendance.update', {
      sessionId: sess.id,
      records: [{ studentId: st.id, status: 'present' }],
    });

    // Vào /students -> mở menu -> Xoá
    await page.goto('/students');
    const row = page.locator('tr', { hasText: nameDebt });
    await row.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa', exact: true }).click();

    // AlertDialog cảnh báo nợ và có nút "Cho nghỉ thay"
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/còn nợ 100\.000/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cho nghỉ thay' })).toBeVisible();

    // Bấm "Cho nghỉ thay"
    await dialog.getByRole('button', { name: 'Cho nghỉ thay' }).click();
    await expect(page.getByText('Đã cho học sinh nghỉ')).toBeVisible();

    // Lọc "Đã nghỉ" thấy HS
    await page.click('button:has-text("Đang học")');
    await page.getByRole('option', { name: 'Đã nghỉ' }).click();
    const rowInactive = page.locator('tr', { hasText: nameDebt });
    await expect(rowInactive).toBeVisible();

    // Mở lại menu của HS đã nghỉ -> Xoá -> Cảnh báo nợ nhưng KHÔNG có nút "Cho nghỉ thay"
    await rowInactive.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa', exact: true }).click();
    const dialog2 = page.getByRole('alertdialog');
    await expect(dialog2.getByText(/còn nợ 100\.000/)).toBeVisible();
    await expect(dialog2.getByRole('button', { name: 'Cho nghỉ thay' })).toHaveCount(0);

    // Bấm Xoá -> HS vào Thùng rác
    await dialog2.getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã chuyển học sinh vào Thùng rác')).toBeVisible();
    await expect(page.getByText(nameDebt)).toHaveCount(0);

    // Dọn dẹp ca dạy
    await trpcMutation(page, 'session.delete', { id: sess.id });
  });
});
