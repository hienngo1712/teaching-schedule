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

async function getDefaultSubjectId(page: Page): Promise<number> {
  const subjects = await trpcQuery<{ id: number; isDefault?: boolean }[]>(page, 'subject.list');
  return (subjects.find((s) => s.isDefault) ?? subjects[0]).id;
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
  const createdStudentIds: number[] = [];
  const createdSessionIds: number[] = [];

  test.beforeEach(async ({ page }) => {
    await loginTeacher(page);
  });

  test.afterEach(async ({ page }) => {
    for (const id of createdSessionIds.splice(0)) {
      try {
        await trpcMutation(page, 'session.delete', { id });
      } catch {}
    }
    for (const id of createdStudentIds.splice(0)) {
      try { await trpcMutation(page, 'student.deactivate', { id }); } catch {}
      try { await trpcMutation(page, 'student.delete', { id }); } catch {}
    }
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
    await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
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
    const subjectId = await getDefaultSubjectId(page);

    // Tạo ca hôm nay theo giờ VN
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const today = vnNow.toISOString().slice(0, 10);
    const session = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: today,
      startTime: '22:00',
      endTime: '23:00',
      subjectId,
      title,
    });

    // Mở lịch và xoá ca
    await page.goto('/calendar');
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
    const subjectId = await getDefaultSubjectId(page);
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

  test('4. HS có dữ liệu: đang học → không xóa được; Đã nghỉ còn nợ → không xóa được; không có nút Cho nghỉ thay', async ({ page }) => {
    const stamp = Math.floor(Math.random() * 100_000);
    const nameDebt = `E2E Nợ ${stamp}`;
    const subjectId = await getDefaultSubjectId(page);
    const st = await trpcMutation<{ id: number }>(page, 'student.create', { fullName: nameDebt, grade: 6, tuitionFee: 100_000 });
    createdStudentIds.push(st.id);
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const vnMonthDay = `${vnNow.toISOString().slice(0, 7)}-03`;
    const h = String(Math.floor(Math.random() * 8) + 6).padStart(2, '0');
    const sess = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: vnMonthDay, startTime: `${h}:00`, endTime: `${h}:45`, subjectId, studentIds: [st.id],
    });
    createdSessionIds.push(sess.id);
    await trpcMutation(page, 'attendance.update', { sessionId: sess.id, attendances: [{ studentId: st.id, attendance: 'present', fee: 100_000 }] });

    await page.goto('/students');
    const row = page.locator('tr', { hasText: nameDebt });
    await row.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/đang học và đã có buổi học hoặc lần thu/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /nghỉ thay/i })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Xóa' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Đóng' }).click();

    // Đánh dấu Đã nghỉ qua menu
    await row.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Đã nghỉ/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Đã nghỉ' }).click();
    await expect(page.getByText('Đã chuyển học sinh sang Đã nghỉ')).toBeVisible();

    await page.click('button:has-text("Đang học")');
    await page.getByRole('option', { name: 'Đã nghỉ' }).click();
    const rowInactive = page.locator('tr', { hasText: nameDebt });
    await rowInactive.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
    const dialog2 = page.getByRole('alertdialog');
    await expect(dialog2.getByText(/còn nợ 100\.000/)).toBeVisible();
    await expect(dialog2.getByRole('button', { name: 'Xóa' })).toHaveCount(0);
  });
});
