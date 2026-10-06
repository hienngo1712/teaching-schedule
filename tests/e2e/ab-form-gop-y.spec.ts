import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const db = new PrismaClient();
const tag = `E2E-AB-${Math.floor(Math.random() * 1_000_000)}`;

async function loginAs(browser: Browser, username: string, viewport = { width: 390, height: 844 }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/overview$/ : /.*dashboard/);
  return page;
}

test.afterAll(async () => {
  await db.feedback.deleteMany({ where: { message: { startsWith: tag } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: tag } } });
  await db.$disconnect();
});

test('nhập file câu trả lời Google Form ra đúng học sinh, có nhắc học phí 0đ', async ({ browser }, testInfo) => {
  const page = await loginAs(browser, 'teacher');
  await page.goto('/students');
  await page.getByTestId('add-student-more').click();
  await page.getByRole('menuitem', { name: 'Nhập Excel' }).click();
  const dialog = page.getByRole('dialog');

  // Mở khối hướng dẫn Google Form để kiểm link
  await dialog.getByText('Chưa có danh sách? Nhờ phụ huynh điền qua Google Form').click();
  await expect(dialog.getByRole('link', { name: /Tạo Google Form/ })).toHaveAttribute('href', 'https://forms.new');

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Câu trả lời biểu mẫu 1');
  sheet.addRow(['Dấu thời gian', 'Họ tên', 'Lớp', 'Tên phụ huynh', 'SĐT phụ huynh', 'Ghi chú']);
  sheet.addRow(['06/10/2026 9:00:00', `${tag} An`, '5', 'Chị Hoa', 912345678, 'Yếu toán']);
  sheet.addRow(['06/10/2026 9:01:00', `${tag} An`, '5', 'Chị Hoa', 912345678, 'Gửi lại']);
  const filePath = testInfo.outputPath('google-form.xlsx');
  await wb.xlsx.writeFile(filePath);

  await dialog.getByTestId('import-file-input').setInputFiles(filePath);
  await expect(dialog.getByTestId('import-summary')).toHaveText('1 hợp lệ · 1 trùng · 0 lỗi');
  await expect(dialog.getByTestId('import-missing-fee')).toBeVisible();
  await dialog.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();
  await dialog.getByRole('button', { name: 'Nhập 1 học sinh' }).click();
  await expect(page.getByText('Đã nhập 1 học sinh')).toBeVisible();
  await page.getByPlaceholder('Tìm tên học sinh...').fill(tag);
  await expect(page.getByText(`${tag} An`, { exact: true }).filter({ visible: true })).toBeVisible();
});

test('gửi góp ý từ menu avatar, admin thấy ở trang Góp ý', async ({ browser }) => {
  const page = await loginAs(browser, 'teacher');
  await page.getByRole('button', { name: /Mở menu tài khoản|Account/ }).click();
  await page.getByRole('menuitem', { name: 'Góp ý' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Góp ý cho app' })).toBeVisible();
  await dialog.getByRole('radio', { name: '4 sao' }).click();
  await dialog.getByLabel(/Cần thêm gì, sửa gì/).fill(`${tag} thêm báo cáo năm`);
  await dialog.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.getByText('Cảm ơn thầy cô đã góp ý!')).toBeVisible();

  const admin = await loginAs(browser, 'admin_test', { width: 1280, height: 900 });
  await admin.goto('/admin/feedback');
  const card = admin.getByTestId('feedback-item').filter({ hasText: `${tag} thêm báo cáo năm` });
  await expect(card).toBeVisible();
  await expect(card).toContainText('teacher');
  await expect(card).toContainText('/dashboard');
});
