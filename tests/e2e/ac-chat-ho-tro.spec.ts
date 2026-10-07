import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

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

test.beforeAll(async () => {
  await db.chatMessage.deleteMany();
  await db.chatConversation.deleteMany();
});

test.afterAll(async () => {
  await db.chatMessage.deleteMany();
  await db.chatConversation.deleteMany();
  await db.$disconnect();
});

test('giáo viên nhắn, admin thấy badge và trả lời, giáo viên thấy tin Hỗ trợ', async ({ browser }) => {
  test.setTimeout(90_000);
  const tag = `AC${Date.now()}`;

  const teacher = await loginAs(browser, 'teacher'); // mobile 390x844
  await teacher.getByRole('button', { name: /^Nhắn hỗ trợ/ }).click();
  await teacher.getByLabel('Nội dung tin nhắn').fill(`${tag} hỏi cách nhập Excel`);
  await teacher.keyboard.press('Enter');
  await expect(teacher.getByTestId('chat-message').filter({ hasText: `${tag} hỏi cách nhập Excel` })).toBeVisible();
  await teacher.keyboard.press('Escape');

  const admin = await loginAs(browser, 'admin_test', { width: 1280, height: 900 });
  await expect(admin.getByTestId('admin-chat-unread').first()).toHaveText('1', { timeout: 35_000 });
  await admin.goto('/admin/chat');
  await admin.getByTestId('admin-chat-item').filter({ hasText: 'teacher' }).first().click();
  await expect(admin.getByText(`${tag} hỏi cách nhập Excel`)).toBeVisible();
  await expect(admin.getByTestId('admin-chat-unread')).toHaveCount(0, { timeout: 15_000 });
  await admin.getByLabel('Nội dung tin nhắn').fill(`${tag} vào Học sinh, chọn Nhập Excel`);
  await admin.getByRole('button', { name: 'Gửi' }).click();

  // Badge giáo viên polling 60 giây: tải lại trang để không phải chờ.
  await teacher.reload();
  await expect(teacher.getByTestId('chat-unread')).toHaveText('1');
  await teacher.getByRole('button', { name: /^Nhắn hỗ trợ/ }).click();
  const reply = teacher.getByTestId('chat-message').filter({ hasText: `${tag} vào Học sinh` });
  await expect(reply).toHaveAttribute('data-mine', 'false');
  await expect(reply.getByText('Hỗ trợ')).toBeVisible();
  await expect(reply.getByText('admin_test')).toHaveCount(0);
  await expect(teacher.getByTestId('chat-unread')).toHaveCount(0, { timeout: 10_000 });
});

test('header giáo viên 375px không tràn ngang', async ({ browser }) => {
  const page = await loginAs(browser, 'teacher', { width: 375, height: 812 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.getByRole('button', { name: /^Nhắn hỗ trợ/ }).boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
});

test('mở khung chat không làm các query khác tải lại liên tục', async ({ browser }) => {
  const page = await loginAs(browser, 'teacher');
  await page.getByRole('button', { name: /^Nhắn hỗ trợ/ }).click();
  const others: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/trpc/')) {
      const path = u.split('/api/trpc/')[1]?.split('?')[0] ?? '';
      const procedures = decodeURIComponent(path).split(',');
      const nonChat = procedures.filter((p) => !p.startsWith('chat.'));
      if (nonChat.length > 0) others.push(...nonChat);
    }
  });
  await page.getByLabel('Nội dung tin nhắn').fill('kiểm tra invalidate');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(12_000);
  expect(others).toEqual([]);
});
