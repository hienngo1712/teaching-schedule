import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const CODE_RE = /SM [ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}/;

async function hideDevBadge(page: Page) {
  // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
}

async function login(page: Page, username: string) {
  await hideDevBadge(page);
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  // Ghi thẳng DB: phải chắc đang trỏ DB test, không phải production.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
});

test.afterAll(async () => {
  await resetStd();
  await db.$disconnect();
});

test.describe('Gói của tôi (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Standard: vào từ sheet Thêm, thẻ Pro đứng đầu, popup chọn sẵn Pro + 12 tháng, tạo mã Plus năm trong popup rồi hủy', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Thêm' }).getByRole('link', { name: /Gói của tôi/ }).click();
    await expect(page).toHaveURL(/\/plan/);

    // J3b: không còn thẻ Gói hiện tại; gói đang dùng hiện trên thẻ gói.
    await expect(page.getByTestId('current-plan')).toHaveCount(0);
    const stdCard = page.getByTestId('plan-card-standard');
    await expect(stdCard).toContainText('Đang dùng');
    await expect(stdCard).toContainText(/Đang có \d+ học sinh đang học/);

    // Mobile: Pro → Plus → Standard từ trên xuống.
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
    expect(await y('plan-card-pro')).toBeLessThan(await y('plan-card-plus'));
    expect(await y('plan-card-plus')).toBeLessThan(await y('plan-card-standard'));
    await expect(page.getByTestId('plan-card-pro')).toContainText('Khuyên dùng');
    await expect(page.getByTestId('plan-card-standard')).toContainText('Đang dùng');
    await expect(page.getByTestId('plan-card-plus')).toContainText('Mọi thứ của gói Standard, thêm:');
    await expect(page.getByTestId('plan-card-pro')).toContainText('Không giới hạn học sinh');

    await expect(page.getByTestId('plan-checkout')).toHaveCount(0);

    await page.getByTestId('plan-card-pro').getByRole('button', { name: 'Chọn gói Pro' }).click();
    const popup = page.getByTestId('plan-purchase');
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('purchase-plan-pro')).toHaveAttribute('aria-checked', 'true');
    await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
    const summary = popup.getByTestId('purchase-summary');
    await expect(summary).toContainText('990.000');

    await popup.getByTestId('purchase-plan-plus').click();
    await expect(summary).toContainText('490.000');
    await popup.getByTestId('purchase-period-2year').click();
    await expect(summary).toContainText('980.000');
    await expect(summary).toContainText('Tặng 2 tháng');
    await expect(popup.getByTestId('purchase-period-2year')).toContainText('Tối đa 26 tháng');
    await popup.getByTestId('purchase-period-year').click();
    await expect(summary).toContainText('490.000');

    // Mobile: toàn màn hình, panel Đơn hàng xếp dưới cột chọn kỳ.
    const popupBox = (await popup.boundingBox())!;
    expect(popupBox.width).toBeGreaterThanOrEqual(389);
    expect((await summary.boundingBox())!.y).toBeGreaterThan((await popup.getByTestId('purchase-period-2year').boundingBox())!.y);

    const allButtonsTall = async () => {
      for (const b of await popup.getByRole('button').all()) {
        expect((await b.boundingBox())!.height, (await b.textContent()) ?? '').toBeGreaterThanOrEqual(44);
      }
    };
    const noOverflow = async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    };
    await allButtonsTall();
    await noOverflow();

    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    const pending = popup.getByTestId('pending-order');
    await expect(pending).toBeVisible();
    await expect(pending).toContainText('Chờ xác nhận');
    await expect(pending).toContainText(CODE_RE);
    await expect(pending).toContainText('490.000');
    await expect(pending.getByRole('img', { name: 'VietQR' })).toBeVisible();
    await allButtonsTall();
    await noOverflow();

    await popup.getByRole('button', { name: 'Xong' }).click();
    await expect(popup).toBeHidden();
    const pagePending = page.getByTestId('pending-order');
    await expect(pagePending).toBeVisible();
    await pagePending.getByRole('button', { name: 'Hủy yêu cầu' }).click();
    await expect(pagePending).toBeHidden();
    await expect(page.getByTestId('plan-history')).toContainText('Đã hủy');
  });
});

test.describe('Gói của tôi (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('desktop: Standard trái, Pro phải, 3 thẻ cao bằng nhau; Chọn gói Plus mở popup chọn sẵn Plus, Đơn hàng bên phải', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.goto('/plan');
    const x = async (id: string) => (await page.getByTestId(id).boundingBox())!.x;
    expect(await x('plan-card-standard')).toBeLessThan(await x('plan-card-plus'));
    expect(await x('plan-card-plus')).toBeLessThan(await x('plan-card-pro'));
    // J3a: 3 thẻ cao bằng nhau, CTA Plus/Pro cùng mép dưới.
    const heights = await Promise.all(
      ['plan-card-standard', 'plan-card-plus', 'plan-card-pro'].map(async (id) => (await page.getByTestId(id).boundingBox())!.height)
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    const ctaBottom = async (plan: string, name: string) => {
      const b = (await page.getByTestId(`plan-card-${plan}`).getByRole('button', { name }).boundingBox())!;
      return b.y + b.height;
    };
    expect(Math.abs((await ctaBottom('plus', 'Chọn gói Plus')) - (await ctaBottom('pro', 'Chọn gói Pro')))).toBeLessThanOrEqual(1);
    await page.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
    const popup = page.getByTestId('plan-purchase');
    await expect(popup.getByTestId('purchase-plan-plus')).toHaveAttribute('aria-checked', 'true');
    await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
    const plusBox = (await popup.getByTestId('purchase-plan-plus').boundingBox())!;
    const proBox = (await popup.getByTestId('purchase-plan-pro').boundingBox())!;
    const summaryBox = (await popup.getByTestId('purchase-summary').boundingBox())!;
    expect(plusBox.x).toBeLessThan(proBox.x);
    expect(summaryBox.x).toBeGreaterThan(proBox.x + proBox.width - 1);
  });
});

for (const width of [768, 820]) {
  test.describe(`Popup mua gói (${width}px)`, () => {
    test.use({ viewport: { width, height: 1024 } });

    test('giá từng thẻ kỳ nằm gọn trong thẻ, trang không tràn ngang', async ({ page }) => {
      await login(page, 'teacher_std');
      await page.goto('/plan');
      await page.getByTestId('plan-card-pro').getByRole('button', { name: 'Chọn gói Pro' }).click();
      const popup = page.getByTestId('plan-purchase');
      await popup.getByTestId('purchase-plan-pro').click();
      await expect(popup.getByTestId('purchase-plan-pro')).toHaveAttribute('aria-checked', 'true');

      for (const period of ['month', 'year', '2year']) {
        const card = popup.getByTestId(`purchase-period-${period}`);
        // Đo bề rộng chữ thật (Range) vì span giá co theo thẻ, chữ nbsp tràn ra ngoài.
        const overflow = await card.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const right = box.right - parseFloat(style.borderRightWidth);
          let worst = -Infinity;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            worst = Math.max(worst, range.getBoundingClientRect().right - right);
          }
          return worst;
        });
        expect(overflow, period).toBeLessThanOrEqual(0);

        // Nhãn kỳ, nhãn ưu đãi, giá phải nằm 1 dòng (chỉ dòng "Tối đa ..." được xuống dòng).
        const wrapped = await card.evaluate((el) => {
          const out: string[] = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const text = walker.currentNode.textContent ?? '';
            if (!text.trim() || text.startsWith('Tối đa')) continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            const tops = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)));
            if (tops.size > 1) out.push(text);
          }
          return out;
        });
        expect(wrapped, period).toEqual([]);
      }
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  });
}

test.describe('Nhãn gói cạnh logo (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('teacher_std: Standard; khi dùng thử: Pro + aria-label Pro dùng thử; teacher: Pro', async ({ page, browser }) => {
    await login(page, 'teacher_std');
    const badge = page.locator('aside').getByTestId('current-plan-badge');
    await expect(badge).toHaveText('Standard');

    await db.user.update({ where: { username: 'teacher_std' }, data: { trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) } });
    await page.reload();
    await expect(badge).toHaveText('Pro');
    await expect(badge).toHaveAttribute('aria-label', 'Pro dùng thử');
    await resetStd();

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const other = await context.newPage();
    await login(other, 'teacher');
    await expect(other.locator('aside').getByTestId('current-plan-badge')).toHaveText('Pro');
    await context.close();
  });
});

test.describe('Nhãn gói trên avatar header (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('teacher_std: Standard, teacher: Pro; nhãn hiện trong nút tài khoản, trang không tràn ngang', async ({ page, browser }) => {
    await login(page, 'teacher_std');
    const badge = page.getByRole('button', { name: 'Mở menu tài khoản' }).getByTestId('current-plan-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('Standard');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const other = await context.newPage();
    await login(other, 'teacher');
    const proBadge = other.getByRole('button', { name: 'Mở menu tài khoản' }).getByTestId('current-plan-badge');
    await expect(proBadge).toBeVisible();
    await expect(proBadge).toHaveText('Pro');
    await context.close();
  });
});

test.describe('Nhãn gói trên avatar header (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('desktop: nhãn trong header ẩn, sidebar vẫn có', async ({ page }) => {
    await login(page, 'teacher_std');
    await expect(page.locator('aside').getByTestId('current-plan-badge')).toHaveText('Standard');
    await expect(page.getByRole('button', { name: 'Mở menu tài khoản' }).getByTestId('current-plan-badge')).toBeHidden();
  });
});

test.describe('Giá đổi khi popup đang mở (spec L Q6, 1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // tests/setup.ts không xóa bảng giá: dọn để file e2e khác thấy 49.000/99.000.
  const resetPrices = () => db.planPriceChange.deleteMany({ where: { changedBy: { not: 'migration' } } });
  test.beforeEach(async () => {
    await resetPrices();
    await resetStd();
  });
  test.afterEach(async () => {
    await resetPrices();
    await resetStd();
  });

  test('bấm Tạo đơn sau khi admin đổi giá → báo giá đổi, hiện giá mới, chưa tạo đơn; bấm lại → QR theo giá mới', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.goto('/plan');
    await page.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
    const popup = page.getByTestId('plan-purchase');
    const summary = popup.getByTestId('purchase-summary');
    await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
    await expect(summary).toContainText('490.000');

    await db.planPriceChange.create({ data: { plan: 'plus', monthPrice: 59000, previousMonthPrice: 49000, changedBy: 'e2e_price' } });
    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    await expect(page.getByText('Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn.')).toBeVisible();
    await expect(summary).toContainText('590.000');
    await expect(popup.getByTestId('pending-order')).toHaveCount(0);
    expect(await db.planOrder.count({ where: { user: { username: 'teacher_std' } } })).toBe(0);

    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    const pending = popup.getByTestId('pending-order');
    await expect(pending).toBeVisible();
    await expect(pending).toContainText('590.000');
  });
});

test.describe('Đơn chờ quá 7 ngày (spec P7, 390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('đơn quá hạn: không còn thẻ chờ/QR, lịch sử hiện Hết hạn', async ({ page }) => {
    await resetStd();
    const u = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
    await db.planOrder.create({
      data: { userId: u.id, plan: 'plus', period: 'year', amount: 490000, code: 'EXP7AB', status: 'pending', createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    await login(page, 'teacher_std');
    await page.goto('/plan');
    await expect(page.getByTestId('plan-history')).toContainText('Hết hạn');
    await expect(page.getByTestId('pending-order')).toHaveCount(0);
    await resetStd();
  });
});
