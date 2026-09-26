import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// Gọi tRPC qua HTTP bằng cookie đăng nhập của page → ghi vào DB test mà dev server đang dùng.
async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

async function trpcQuery<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.get(`/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`);
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

// Ngày trong tháng TRƯỚC theo giờ VN (Dashboard tính tháng hiện tại theo VN).
function dayInPreviousVnMonth(): string {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - 1, day)).toISOString().slice(0, 10);
}

test.describe('Cảnh báo Dashboard (390px)', () => {
  const createdStudentIds: number[] = [];
  const createdSessionIds: number[] = [];

  test.beforeEach(async ({ page }) => {
    // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
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

  // Dọn: xoá ca, nghỉ học (soft delete) HS đã tạo → không còn trong cảnh báo của lần chạy sau.
  test.afterEach(async ({ page }) => {
    for (const id of createdSessionIds.splice(0)) await trpcMutation(page, 'session.delete', { id });
    for (const id of createdStudentIds.splice(0)) await trpcMutation(page, 'student.delete', { id });
  });

  test('HS nợ tháng trước → bấm dòng nợ mở màn Học phí với sheet đúng HS', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E HS nợ có tên rất dài để kiểm tra truncate ${stamp}`;
    const fee = 9_000_000; // lớn để nằm trong 3 dòng đầu (nhóm nợ sắp theo số tiền giảm dần)

    const subjects = await trpcQuery<{ id: number }[]>(page, 'subject.list', { isActive: true });
    const student = await trpcMutation<{ id: number }>(page, 'student.create', {
      fullName: name, grade: 5, tuitionFee: fee,
    });
    createdStudentIds.push(student.id);
    const hour = String(Math.floor(Math.random() * 12) + 6).padStart(2, '0');
    const session = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: dayInPreviousVnMonth(), startTime: `${hour}:05`, endTime: `${hour}:55`, subjectId: subjects[0].id,
    });
    createdSessionIds.push(session.id);
    await trpcMutation(page, 'session.addStudents', { sessionId: session.id, studentIds: [student.id] });
    await trpcMutation(page, 'attendance.update', {
      sessionId: session.id,
      attendances: [{ studentId: student.id, attendance: 'present', fee }],
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Cần chú ý' })).toBeVisible();
    const debtGroup = page.getByTestId('alert-group-debt');
    const viewAll = debtGroup.getByRole('button', { name: /Xem tất cả/ });
    if (await viewAll.isVisible()) await viewAll.click();
    const row = debtGroup.getByTestId('alert-row').filter({ hasText: name });
    await expect(row).toContainText('9.000.000');
    await expect(row).toContainText('Nợ 1 tháng');
    await expectNoHorizontalScroll(page);

    await row.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/tuition\\?.*studentId=${student.id}`));
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(name);

    // Đóng sheet → không tự mở lại (kể cả khi query refetch).
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('nhóm có hơn 3 dòng → Xem tất cả mở đủ, Thu gọn về 3', async ({ page }) => {
    const stamp = Date.now();
    for (let i = 1; i <= 4; i++) {
      const s = await trpcMutation<{ id: number }>(page, 'student.create', {
        fullName: `E2E HS chưa xếp lịch ${stamp} ${i}`, grade: 1,
      });
      createdStudentIds.push(s.id);
    }

    await page.goto('/dashboard');
    const idleGroup = page.getByTestId('alert-group-idle');
    await expect(idleGroup).toBeVisible();
    await expect(idleGroup.getByTestId('alert-row')).toHaveCount(3);

    const viewAll = idleGroup.getByRole('button', { name: /Xem tất cả \(\d+\)/ });
    const total = Number((await viewAll.textContent())?.match(/\((\d+)\)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(4);
    await viewAll.click();
    await expect(idleGroup.getByTestId('alert-row')).toHaveCount(total);
    await expectNoHorizontalScroll(page);

    await idleGroup.getByRole('button', { name: 'Thu gọn' }).click();
    await expect(idleGroup.getByTestId('alert-row')).toHaveCount(3);
  });
});
