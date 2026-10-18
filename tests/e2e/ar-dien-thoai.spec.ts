import { test, expect, type Page } from '@playwright/test';
import { CONSENT_ACCEPTED } from '../../src/lib/consent';

// Spec AR A2 + A3 ở 375: tên môn dài hiện đủ (không "…"); nút X của hộp/sheet vùng chạm ≥44px, không đè tiêu đề.
test.use({ viewport: { width: 375, height: 812 } });

const SHOTS = '../student-managerment/.superpowers/mockups/aj/that-ar';
const LONG = `Luyện thi học sinh giỏi Toán và Tiếng Việt lớp 5 nâng cao cuối tuần ${Date.now()}`;

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

async function expectCloseFits(page: Page, dialog: ReturnType<Page['getByRole']>, title: string) {
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const close = (await dialog.getByRole('button', { name: 'Close' }).boundingBox())!;
  expect(close.width).toBeGreaterThanOrEqual(44);
  expect(close.height).toBeGreaterThanOrEqual(44);
  // Đo phần chữ tiêu đề (thẻ h2 rộng hết khung, chữ căn giữa): chữ phải kết thúc trước nút X hoặc nằm dưới nó.
  const head = await dialog.getByRole('heading', { name: title }).evaluate((el) => {
    const r = document.createRange()
    r.selectNodeContents(el)
    const b = r.getBoundingClientRect()
    return { x: b.x, y: b.y, width: b.width }
  });
  expect(head.x + head.width <= close.x || head.y >= close.y + close.height).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('375px: tên môn dài hiện đủ; nút X hộp Thêm học sinh và sheet Bộ lọc ≥44px, không đè tiêu đề', async ({ page }) => {
  await login(page);
  const res = await page.request.post('/api/trpc/subject.create', { data: { name: LONG, color: '#0d9488' } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const subjectId = (await res.json()).result.data.id as number;
  try {
    await page.goto('/subjects');
    const name = page.getByTestId('subject-card').getByText(LONG);
    await expect(name).toBeVisible();
    // Hiện đủ: không bị cắt (không tràn ngang trong ô) và xuống nhiều dòng.
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await name.boundingBox())!.height).toBeGreaterThan(30);
    await name.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/mon-hoc-375.png` });

    await page.goto('/students');
    await page.getByRole('button', { name: /Thêm học sinh/ }).first().click();
    const dlg = page.getByRole('dialog');
    await expectCloseFits(page, dlg, 'Thêm học sinh');
    await page.screenshot({ path: `${SHOTS}/hop-them-hs-375.png` });
    await dlg.getByRole('button', { name: 'Close' }).click();
    await expect(dlg).toHaveCount(0);

    await page.getByRole('button', { name: /^Bộ lọc/ }).click();
    const sheet = page.getByRole('dialog');
    await expectCloseFits(page, sheet, 'Bộ lọc');
    await page.screenshot({ path: `${SHOTS}/sheet-bo-loc-375.png` });
  } finally {
    await page.request.post('/api/trpc/subject.delete', { data: { id: subjectId } });
  }
});

// Nút X 44px không được đè nút ⋯ ở đầu sheet Chi tiết học phí (lỗi lộ ra khi chụp lại ảnh HD).
test('375px: sheet Chi tiết học phí, nút ⋯ không bị nút X đè, bấm mở được menu', async ({ page }) => {
  await login(page);
  const res = await page.request.post('/api/trpc/student.create', {
    data: { consent: CONSENT_ACCEPTED, fullName: `E2E AR Sheet ${Date.now()}`, grade: 5, tuitionFee: 100000 },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const id = (await res.json()).result.data.id as number;
  try {
    await page.goto(`/tuition?studentId=${id}`);
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const more = sheet.getByTestId('tuition-sheet-more');
    const [m, x] = [(await more.boundingBox())!, (await sheet.getByRole('button', { name: 'Close' }).boundingBox())!];
    // 2 nút không chồng nhau.
    expect(m.x + m.width <= x.x || m.y >= x.y + x.height).toBe(true);
    await page.screenshot({ path: `${SHOTS}/sheet-hoc-phi-375.png` });
    await more.click();
    await expect(page.getByRole('menu')).toBeVisible();
  } finally {
    await page.request.post('/api/trpc/student.delete', { data: { id } });
  }
});
