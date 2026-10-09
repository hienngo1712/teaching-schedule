# AI — Chuông báo "phụ huynh đã chuyển" payOS (0.18.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên đang mở app được báo ngay (toast + chuông có số chưa đọc) khi phụ huynh chuyển tiền qua payOS, biết khoản đó của học sinh nào, bấm là mở học sinh đó; trang học phí tự cập nhật không cần F5. Phát hành `0.18.0`.

**Architecture:** Không bảng mới: đọc `TuitionPayLinkPayment` (đợt còn sống) + cột mới `User.payosSeenAt`. Router `payosNotice` (`list`, `markSeen`). Component `PayosBell` trong `AppHeader`: query hỏi lại 30s khi tab hiện + khi quay lại tab, so `createdAt` mới nhất để toast và invalidate dữ liệu học phí.

**Tech Stack:** Next.js 15, tRPC v11 + React Query, Prisma 5 (1 migration chỉ thêm), sonner, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-ai-thong-bao-tien-payos-design.md` (đọc HẾT trước Task 1). Tham khảo: `src/components/whats-new/WhatsNew.tsx` (Popover desktop / Sheet mobile), `src/server/services/payos-paid.service.ts` (quy tắc "đợt còn sống"), `tests/integration/tuition-payos-webhook.test.ts` (dựng link + payload webhook).

## Global Constraints

- Nhánh `feat/ai-thong-bao-payos` (Claude tạo sẵn, có spec + plan). Version cuối `0.18.0`. Không cài thư viện.
- **Migration chỉ thêm** 1 cột nullable `users.payos_seen_at`. Tạo SQL (sau `set -a; . ./.env.test; set +a`, kiểm `DATABASE_URL` chứa `localhost:5433`): `mkdir -p prisma/migrations/<YYYYMMDDHHmmss>_payos_seen_at && pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<…>/migration.sql`; đọc SQL (chỉ `ALTER TABLE "users" ADD COLUMN`), `pnpm exec prisma migrate deploy` (Datasource phải in `localhost:5433`), `pnpm exec prisma generate`. Cấm chạy prisma lên `.env`; cấm `db:reset`/`migrate reset`/`db push`. Prisma báo drift/đòi reset → STOP.
- Không `pnpm build`/`pnpm dev`. Người dùng ĐÃ ĐỒNG Ý Task 5 chạy `pnpm exec playwright test -c playwright.guide-shots.config.ts` + `pnpm guide:docx` (chỉ giữ ảnh mới `chuong-payos-*`, khôi phục các ảnh khác bằng `git checkout --`).
- Test 3 tầng: mỗi task test của task + `pnpm exec tsc --noEmit` + `pnpm lint`; full `pnpm test` + full e2e 2 nửa chỉ ở Task 6. Khoá test `.superpowers/test-lock.txt` bắt buộc. e2e: RAM ≥ 3000 MB, foreground, seed trước (`pnpm test tests/integration/plan-launch-migration.test.ts`), chỉ dừng PID mình tạo (cả mock 4010), tắt cổng 3000 khi xong.
- **Mobile-first**: 375px trước; vùng chạm ≥ 44px; header 375px không tràn ngang khi thêm chuông; chụp 375px và tự mở xem, nhận xét vào ledger.
- Chữ qua i18n `vi.json` + `en.json` cùng bộ key. Không gạch dài (—, –) trong chữ hiển thị. Màu có sẵn (primary/slate/red/emerald).
- Không log tên HS/số tiền ở server. Commit 1 dòng, không body, không attribution. Ghi chú code tiếng Việt 1–2 dòng. Không xoá/nới test cũ; đổi kỳ vọng test cũ chỉ khi đúng hành vi mới + Ruling. Ledger `.superpowers/sdd/2026-10-09-ai-thong-bao-tien-payos/progress.md`.

## Review Focus

1. **Khoản vào đúng lúc giáo viên đang mở chuông** → không được đánh dấu đã đọc oan. Test: Task 1 "markSeen theo upTo: khoản mới hơn upTo vẫn chưa đọc".
2. **Giáo viên chưa nối payOS** → không được hỏi server 30s/lần (tốn tài nguyên cho mọi người dùng). Test: Task 2 "enabled false → không render, refetchInterval false".
3. **Lần tải đầu có 15 khoản cũ chưa đọc** → không được bắn 15 toast. Test: Task 3 "lần đầu chỉ 1 toast tóm tắt".
4. **Giáo viên A thấy thông báo tiền của giáo viên B.** Test: Task 1 "chỉ thông báo của mình".
5. **Header 375px tràn ngang/bóp nút khi thêm chuông.** Kiểm: Task 6 ảnh 375px + e2e kiểm `document.documentElement.scrollWidth <= 375`.

## Bên thực thi

- **Claude-OTD làm Task 1 → 6** tuần tự ở `D:\APINODEJS\student-managerment`, nhánh `feat/ai-thong-bao-payos` (đã checkout). Luật `.superpowers/claude-otd/CLAUDE-OTD.md`.

---

### Task 1: Cột `payosSeenAt` + service + router `payosNotice`

**Files:**
- Modify: `prisma/schema.prisma` (`User` thêm `payosSeenAt DateTime? @map("payos_seen_at")` + ghi chú "Mốc GV mở chuông tiền payOS gần nhất (spec AI)"), migration mới
- Create: `src/server/services/payos-notice.service.ts`, `src/server/trpc/routers/payos-notice.ts`; Modify: `src/server/trpc/root.ts` (`payosNotice: payosNoticeRouter`)
- Test: `tests/integration/payos-notice.test.ts`

**Interfaces:**
- Produces:
  - `type PayosNoticeItem = { id: number; studentId: number; studentName: string; studentDeleted: boolean; amount: number; paidAt: Date; year: number; month: number; createdAt: Date; unread: boolean }`
  - `listPayosNotices(db, userId): Promise<{ enabled: boolean; unread: number; items: PayosNoticeItem[] }>`
  - `markPayosNoticesSeen(db, userId, upTo: Date): Promise<{ seenAt: Date }>`
  - tRPC `payosNotice.list` (query), `payosNotice.markSeen({ upTo: string })` (mutation, `z.string().datetime()`).

- [ ] **Step 1: Test hỏng** `tests/integration/payos-notice.test.ts`. Dựng như `tuition-payos-webhook.test.ts` (user `teacher` Pro, HS, 2 buổi tháng 8, `teacherPayos` hookId `"H".repeat(43)` khoá `t-checksum`, `makeLink`, `payload`, ghi tiền bằng `handleTuitionWebhook`); `beforeEach` đặt `payosSeenAt: null`. Cases:

```ts
it("chưa nối payOS, chưa có lịch sử → enabled false, rỗng", async () => {
  await db.teacherPayos.deleteMany({ where: { userId } })
  expect(await listPayosNotices(db, userId)).toEqual({ enabled: false, unread: 0, items: [] })
})
it("đã nối, chưa có tiền → enabled true, rỗng", async () => {
  expect(await listPayosNotices(db, userId)).toEqual({ enabled: true, unread: 0, items: [] })
})
it("có tiền → item đủ trường, tên HS giải mã, chưa đọc", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  const r = await listPayosNotices(db, userId)
  expect(r.unread).toBe(1)
  expect(r.items[0]).toMatchObject({ studentId, studentName: "Trần Thị Bé", studentDeleted: false, amount: 200000, year: 2026, month: 8, unread: true })
  expect(r.items[0].paidAt.toISOString()).toBe("2026-10-09T07:32:00.000Z")
})
it("đợt thu đã xoá → không còn trong danh sách và số chưa đọc", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  const p = await db.payment.findFirstOrThrow({ where: { method: "payos" } })
  await caller.payment.deleteBatch({ batchId: p.batchId! })
  expect(await listPayosNotices(db, userId)).toMatchObject({ unread: 0, items: [] })
})
it("đã ngắt payOS nhưng có lịch sử → enabled true", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  await db.teacherPayos.delete({ where: { userId } })
  expect((await listPayosNotices(db, userId)).enabled).toBe(true)
})
it("chỉ 20 dòng mới nhất, unread đếm hết", async () => {
  const l = await makeLink({ amount: 1000 })
  for (let i = 0; i < 22; i++) await handleTuitionWebhook(db, HOOK, payload(l, 1000, `R-${i}`))
  const r = await listPayosNotices(db, userId)
  expect(r.items).toHaveLength(20)
  expect(r.unread).toBe(22)
  expect(r.items[0].createdAt >= r.items[19].createdAt).toBe(true)
})
it("chỉ thông báo của mình", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  const other = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
  expect(await listPayosNotices(db, other.id)).toEqual({ enabled: false, unread: 0, items: [] })
})
it("markSeen theo upTo: khoản mới hơn upTo vẫn chưa đọc; không lùi mốc", async () => {
  const l = await makeLink({ amount: 1000 })
  await handleTuitionWebhook(db, HOOK, payload(l, 1000, "A"))
  const first = (await listPayosNotices(db, userId)).items[0]
  await handleTuitionWebhook(db, HOOK, payload(l, 1000, "B"))
  await markPayosNoticesSeen(db, userId, first.createdAt)
  const r = await listPayosNotices(db, userId)
  expect(r.unread).toBe(1)
  expect(r.items.find((i) => i.unread)?.id).not.toBe(first.id)
  await markPayosNoticesSeen(db, userId, new Date("2020-01-01"))
  expect((await listPayosNotices(db, userId)).unread).toBe(1)
})
it("markSeen upTo ở tương lai → dùng giờ hiện tại", async () => {
  const { seenAt } = await markPayosNoticesSeen(db, userId, new Date(Date.now() + 3600_000))
  expect(seenAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
})
it("HS đã xoá mềm → studentDeleted true", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  await db.student.update({ where: { id: studentId }, data: { isDeleted: true, deletedAt: new Date() } })
  expect((await listPayosNotices(db, userId)).items[0].studentDeleted).toBe(true)
})
it("router: list + markSeen qua caller", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  const r = await caller.payosNotice.list()
  await caller.payosNotice.markSeen({ upTo: new Date(r.items[0].createdAt).toISOString() })
  expect((await caller.payosNotice.list()).unread).toBe(0)
})
```

- [ ] **Step 2: Chạy** `pnpm test tests/integration/payos-notice.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 3: Schema + migration** theo Global Constraints.

- [ ] **Step 4: Service** `payos-notice.service.ts`:

```ts
import type { PrismaClient } from "@prisma/client"

const LIMIT = 20
// Đồng hồ client lệch: upTo quá giờ server thì kẹp về now, tránh khoản sắp vào bị coi là đã đọc.
const FUTURE_SLACK_MS = 60_000

export type PayosNoticeItem = {
  id: number; studentId: number; studentName: string; studentDeleted: boolean
  amount: number; paidAt: Date; year: number; month: number; createdAt: Date; unread: boolean
}

// Chỉ đợt thu còn sống (cùng quy tắc "PH đã chuyển" ở payos-paid.service): GV xoá đợt thì thông báo cũng mất.
async function liveRows(db: PrismaClient, userId: number) {
  const rows = await db.tuitionPayLinkPayment.findMany({
    where: { link: { userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, amount: true, paidAt: true, createdAt: true, batchId: true,
      link: { select: { studentId: true, year: true, month: true, student: { select: { fullName: true, isDeleted: true } } } },
    },
  })
  if (rows.length === 0) return rows
  const live = new Set((await db.payment.findMany({
    where: { batchId: { in: rows.map((r) => r.batchId) }, isDeleted: false },
    select: { batchId: true }, distinct: ["batchId"],
  })).map((p) => p.batchId))
  return rows.filter((r) => live.has(r.batchId))
}

export async function listPayosNotices(db: PrismaClient, userId: number) {
  const [user, connected, rows] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { payosSeenAt: true } }),
    db.teacherPayos.count({ where: { userId } }),
    liveRows(db, userId),
  ])
  if (!connected && rows.length === 0) return { enabled: false, unread: 0, items: [] as PayosNoticeItem[] }
  const isUnread = (c: Date) => !user.payosSeenAt || c > user.payosSeenAt
  return {
    enabled: true,
    unread: rows.filter((r) => isUnread(r.createdAt)).length,
    items: rows.slice(0, LIMIT).map((r): PayosNoticeItem => ({
      id: r.id, studentId: r.link.studentId, studentName: r.link.student.fullName, studentDeleted: r.link.student.isDeleted,
      amount: r.amount, paidAt: r.paidAt, year: r.link.year, month: r.link.month, createdAt: r.createdAt, unread: isUnread(r.createdAt),
    })),
  }
}

export async function markPayosNoticesSeen(db: PrismaClient, userId: number, upTo: Date) {
  const now = new Date()
  const target = upTo.getTime() > now.getTime() + FUTURE_SLACK_MS ? now : upTo
  const cur = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { payosSeenAt: true } })
  if (cur.payosSeenAt && cur.payosSeenAt >= target) return { seenAt: cur.payosSeenAt }
  await db.user.update({ where: { id: userId }, data: { payosSeenAt: target } })
  return { seenAt: target }
}
```
Lưu ý: `liveRows` đọc mọi dòng của GV (để đếm unread chính xác) — GV có vài trăm giao dịch/năm nên ổn; ghi chú 1 dòng nếu thấy cần.

- [ ] **Step 5: Router** `routers/payos-notice.ts`:

```ts
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { listPayosNotices, markPayosNoticesSeen } from "@/server/services/payos-notice.service"

export const payosNoticeRouter = createTRPCRouter({
  // Không chặn theo gói: hết Pro vẫn xem lịch sử tiền đã vào (spec AI §4).
  list: protectedProcedure.query(({ ctx }) => listPayosNotices(ctx.db, ctx.userId)),
  markSeen: protectedProcedure
    .input(z.object({ upTo: z.string().datetime() }))
    .mutation(({ ctx, input }) => markPayosNoticesSeen(ctx.db, ctx.userId, new Date(input.upTo))),
})
```
Gắn `payosNotice: payosNoticeRouter` vào `root.ts`.

- [ ] **Step 6: Chạy** → PASS. tsc, lint sạch.

- [ ] **Step 7: Commit** `feat(ai): danh sách thông báo tiền payOS + đánh dấu đã xem`.

---

### Task 2: `PayosBell` — nút, huy hiệu, danh sách, đánh dấu đã xem, mở học sinh

**Files:**
- Create: `src/components/payos/PayosBell.tsx`, `src/components/payos/PayosNoticeList.tsx`
- Modify: i18n vi/en
- Test: `tests/unit/components/PayosBell.test.tsx`

**Interfaces:**
- Consumes: `trpc.payosNotice.list/markSeen` (Task 1).
- Produces: `PayosBell` (không prop); `PayosNoticeList({ items, onPick })`; hằng `PAYOS_POLL_MS = 30_000` export từ `PayosBell.tsx`; hàm `noticeHref(item): string | null` (null khi `studentDeleted`).

- [ ] **Step 1: Test hỏng** (jsdom; mock `@/lib/trpc` giống `AdminOrderHistory.test.tsx`, ghi lại options của `useQuery`; mock `next/navigation` `useRouter().push`; mock `@/hooks/useMediaQuery` → true (desktop) hoặc false theo case; `LanguageProvider forcedLanguage="vi"`):

```tsx
it("enabled false → không render gì, không hỏi định kỳ", () => {
  data = { enabled: false, unread: 0, items: [] }
  const { container } = renderBell()
  expect(container.innerHTML).toBe("")
  expect(lastQueryOpts().refetchInterval({ state: { data } })).toBe(false)
})
it("enabled true → hỏi lại 30s, có hỏi khi quay lại tab, không hỏi khi tab ẩn", () => {
  data = { enabled: true, unread: 0, items: [] }
  renderBell()
  const o = lastQueryOpts()
  expect(o.refetchInterval({ state: { data } })).toBe(30_000)
  expect(o.refetchOnWindowFocus).toBe(true)
  expect(o.refetchIntervalInBackground).toBe(false)
})
it("huy hiệu số chưa đọc; >9 hiện 9+", () => { /* unread 3 → thấy "3"; rerender unread 12 → thấy "9+" */ })
it("mở chuông → markSeen với createdAt mới nhất; danh sách hiện 'PH của Trần Thị Bé đã chuyển 200.000 đ'", async () => { /* bấm nút aria-label "Thông báo tiền học" → markSeen.mutate({ upTo: items[0].createdAt ISO }) */ })
it("unread 0 → mở chuông không gọi markSeen", () => { /* … */ })
it("bấm dòng → push /tuition?year=2026&month=8&studentId=<id> và đóng", () => { /* … */ })
it("HS đã xoá → dòng không bấm được (không có link/nút)", () => { /* studentDeleted true → getByText tên nhưng queryByRole('button', { name: /Trần Thị Bé/ }) null */ })
it("rỗng → chữ hướng dẫn", () => { /* thấy 'Chưa có khoản nào' */ })
it("mobile: mở Sheet thay Popover", () => { /* useMediaQuery false → bấm nút → role dialog có tiêu đề 'Tiền học qua payOS' */ })
```
Viết đủ thân các case `/* … */` theo mô tả.

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Code.** Bố cục theo `WhatsNew.tsx` (Popover desktop `align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0"`, Sheet mobile `side="bottom"` có `SheetTitle`). Nút: `Button variant="outline" size="icon" className="relative size-11 text-slate-600 md:size-10"`, icon `Bell` (lucide), `aria-label={t("payos_bell_label")}`; huy hiệu `absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white ring-2 ring-white`.
  Query:

```ts
export const PAYOS_POLL_MS = 30_000
const { data } = trpc.payosNotice.list.useQuery(undefined, {
  // Chưa nối payOS và chưa có lịch sử: không hỏi định kỳ (spec AI §5).
  refetchInterval: (q) => (q.state.data?.enabled ? PAYOS_POLL_MS : false),
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
})
```
  Mở: `setOpen(true)`; nếu `data.unread > 0 && data.items[0]` → `utils.payosNotice.list.setData(undefined, (d) => d && { ...d, unread: 0 })` rồi `markSeen.mutate({ upTo: new Date(data.items[0].createdAt).toISOString() })`. Giữ `unread` từng dòng như dữ liệu lúc mở (snapshot `items` vào state khi mở) để chấm còn tới khi đóng.
  `noticeHref = (i) => i.studentDeleted ? null : \`/tuition?year=${i.year}&month=${i.month}&studentId=${i.studentId}\``.
  `PayosNoticeList`: `<ul>`; mỗi `<li>` có `<button className="flex min-h-11 w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-slate-50">` (HS đã xoá: `<div>` cùng kiểu, chữ `text-slate-500`); chấm `size-2 rounded-full bg-primary` khi unread + nền `bg-primary/5`; dòng 1 `t("payos_notice_line")` thay `{name}`/`{amount}` (tên + số tiền in đậm: tách chuỗi theo placeholder như cách `payos_help` làm ở `PayosTuitionCard`), dòng 2 `text-xs text-slate-500` `t("payos_notice_meta")` thay `{time}` (HH:mm giờ VN), `{d}` (D/M), `{month}`.
  i18n vi (en dịch):
  - `payos_bell_label`: "Thông báo tiền học"
  - `payos_bell_title`: "Tiền học qua payOS"
  - `payos_notice_line`: "PH của {name} đã chuyển {amount}"
  - `payos_notice_meta`: "{time} ngày {d} · Học phí tháng {month}"
  - `payos_notice_empty`: "Chưa có khoản nào. Khi phụ huynh quét QR payOS trên phiếu, tiền vào sẽ hiện ở đây."
  - `payos_notice_limit`: "Chỉ hiện 20 khoản gần nhất"
  - `payos_notice_new_many`: "Có {n} khoản tiền mới qua payOS"
  - `payos_notice_view`: "Xem"

- [ ] **Step 4: Chạy** → PASS. tsc, lint.

- [ ] **Step 5: Commit** `feat(ai): chuông thông báo tiền payOS (danh sách, chưa đọc, mở học sinh)`.

---

### Task 3: Toast khoản mới + tự làm mới dữ liệu học phí

**Files:**
- Create: `src/components/payos/usePayosNoticeToasts.ts` (hook)
- Modify: `src/components/payos/PayosBell.tsx` (gọi hook)
- Test: `tests/unit/components/PayosBellToast.test.tsx`

**Interfaces:**
- Consumes: `data` của `payosNotice.list`, `noticeHref` (Task 2), `useTourActive` (`@/lib/tour-store`), `toast` (sonner).
- Produces: `usePayosNoticeToasts(data: ListData | undefined, onOpenBell: () => void): void`.

- [ ] **Step 1: Test hỏng** (mock `sonner` `toast`/`toast.success` ghi lại lời gọi + `action`; mock trpc `useUtils` có `tuition.invalidate`, `payment.invalidate`, `report.invalidate`; mock `@/lib/tour-store` `useTourActive` trả biến `tour`; dùng `renderHook` với `rerender(data mới)`):

```ts
it("lần tải đầu, unread 2 → đúng 1 toast tóm tắt 'Có 2 khoản tiền mới qua payOS', không invalidate", () => { /* … */ })
it("lần tải đầu, unread 0 → không toast", () => { /* … */ })
it("lần sau có 1 dòng mới (createdAt lớn hơn) → toast.success 'PH của Trần Thị Bé đã chuyển 200.000 đ' + action Xem push deep link; invalidate tuition/payment/report", () => { /* … */ })
it("lần sau có 4 dòng mới → 1 toast tóm tắt", () => { /* … */ })
it("dữ liệu không đổi (cùng createdAt mới nhất) → không toast lại", () => { /* … */ })
it("đang chạy tour → hoãn; tour tắt → toast ra", () => { /* tour=true rerender dòng mới → không toast; tour=false rerender → toast */ })
```

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Code.**

```ts
"use client"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { useTourActive } from "@/lib/tour-store"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { formatCurrency } from "@/lib/utils"
import { noticeHref } from "./PayosBell"
import type { RouterOutputs } from "@/lib/trpc"

type ListData = RouterOutputs["payosNotice"]["list"]
const MAX_SINGLE = 3

export function usePayosNoticeToasts(data: ListData | undefined, onOpenBell: () => void) {
  const { t } = useTranslation()
  const router = useRouter()
  const utils = trpc.useUtils()
  const tour = useTourActive()
  // Mốc createdAt mới nhất đã báo trong phiên; null = chưa có lần tải nào.
  const known = useRef<number | null>(null)

  useEffect(() => {
    if (!data?.enabled || tour) return
    const newest = data.items[0] ? new Date(data.items[0].createdAt).getTime() : 0
    if (known.current === null) {
      known.current = newest
      if (data.unread > 0) toast(t("payos_notice_new_many").replace("{n}", String(data.unread)), { action: { label: t("payos_notice_view"), onClick: onOpenBell } })
      return
    }
    const fresh = data.items.filter((i) => new Date(i.createdAt).getTime() > known.current!)
    if (fresh.length === 0) return
    known.current = newest
    void utils.tuition.invalidate()
    void utils.payment.invalidate()
    void utils.report.invalidate()
    if (fresh.length > MAX_SINGLE) {
      toast(t("payos_notice_new_many").replace("{n}", String(fresh.length)), { action: { label: t("payos_notice_view"), onClick: onOpenBell } })
      return
    }
    for (const i of fresh) {
      const href = noticeHref(i)
      toast.success(t("payos_notice_line").replace("{name}", i.studentName).replace("{amount}", formatCurrency(i.amount)),
        href ? { action: { label: t("payos_notice_view"), onClick: () => router.push(href) } } : undefined)
    }
  }, [data, tour, t, router, utils, onOpenBell])
}
```
(Kiểm import thật của `RouterOutputs` / `formatCurrency` trong repo, chỉnh đường dẫn cho đúng — Ruling nếu khác.) Trong `PayosBell` gọi `usePayosNoticeToasts(data, openBell)` với `openBell` ổn định (`useCallback`).

- [ ] **Step 4: Chạy** → PASS; test Task 2 vẫn xanh. tsc, lint.

- [ ] **Step 5: Commit** `feat(ai): toast khi phụ huynh vừa chuyển tiền, tự làm mới học phí`.

---

### Task 4: Gắn chuông vào header

**Files:**
- Modify: `src/components/layout/AppHeader.tsx` (`{!admin && <PayosBell />}` ngay trước `{!admin && <WhatsNew />}`)
- Modify: `tests/unit/components/AppHeader.test.tsx` (mock trpc thêm `payosNotice.list.useQuery` trả `{ data: { enabled: false, unread: 0, items: [] } }`, `payosNotice.markSeen.useMutation`; thêm case)

- [ ] **Step 1: Test hỏng** trong `AppHeader.test.tsx`:

```tsx
it("giáo viên đã nối payOS → có nút 'Thông báo tiền học'; admin thì không", () => { /* enabled true → getByRole('button', { name: 'Thông báo tiền học' }); variant admin → queryByRole null */ })
```
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Code** (1 dòng + import).
- [ ] **Step 4: Chạy** `pnpm test tests/unit/components/AppHeader.test.tsx tests/unit/components/PayosBell*.test.tsx` → PASS. tsc, lint.
- [ ] **Step 5: Commit** `feat(ai): chuông tiền payOS trên thanh trên cùng`.

---

### Task 5: Hướng dẫn + ảnh `chuong-payos`

**Files:**
- Modify: `src/lib/guide-content.ts` (mục `payos-hoc-phi`: thêm bước sau bước `da-chuyen-payos`: `{ text: "Chuông 🔔 trên cùng báo ngay khoản vừa vào và của học sinh nào, không cần tải lại trang; bấm một dòng để mở học sinh đó.", shot: "chuong-payos" }`)
- Modify: `tests/unit/lib/guide-content.test.ts` (đếm shot +1), `tests/guide-shots/guide-shots.spec.ts` (shot `chuong-payos` ngay sau `da-chuyen-payos`: mở chuông bằng `getByRole("button", { name: "Thông báo tiền học" })`, `mark` danh sách, `shot`)
- Output: `public/guide/chuong-payos-{mobile,desktop}.jpg`, docx

- [ ] **Step 1:** Sửa test đếm shot → chạy → FAIL. **Step 2:** sửa `guide-content.ts` → PASS. **Step 3:** chạy guide-shots (khoá test, RAM), **mở xem** 2 ảnh mới, khôi phục mọi ảnh khác (`git checkout -- <ảnh không phải chuong-payos>`), `pnpm guide:docx`. **Step 4: Commit** `docs(ai): hướng dẫn chuông tiền payOS + ảnh`.

---

### Task 6: e2e, ảnh 375px, phát hành 0.18.0, full test

**Files:**
- Create: `tests/e2e/ai-thong-bao-payos.spec.ts`; Modify: `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half2.txt` (thêm tên spec cuối dòng duy nhất)
- Modify: `package.json` (`0.18.0`), `src/lib/releases.ts` (mục 0.18.0 theo khuôn 0.17.0: "Chuông báo khi phụ huynh chuyển tiền qua payOS, không cần tải lại trang.")

- [ ] **Step 1: e2e** (vòng 375 và 1280; dựng GV Pro + `teacherPayos` + HS + 1 buổi tháng trước + link payOS bằng PrismaClient thô như `ah-payos-hoc-phi.spec.ts`; đăng nhập như spec đó):
  1. Vào `/dashboard`; kiểm `await page.evaluate(() => document.documentElement.scrollWidth)` ≤ viewport width; chụp `ai-1-header-<w>.png`.
  2. Gửi webhook giả `request.post("/api/payos/tuition/<hookId>")` (payload ký bằng khoá giả) → 200.
  3. **Không reload**: `await expect(page.getByText(/PH của .* đã chuyển/)).toBeVisible({ timeout: 45_000 })` (toast); huy hiệu chuông hiện "1"; chụp `ai-2-toast-<w>.png`.
  4. Bấm chuông → danh sách có dòng; huy hiệu biến mất; chụp `ai-3-chuong-<w>.png`.
  5. Bấm dòng → URL chứa `/tuition?year=` và `studentId=`; sheet chi tiết HS mở (theo cách test y-thu-hoc-phi nhận sheet).
  Ảnh lưu `.superpowers/sdd/2026-10-09-ai-thong-bao-tien-payos/`. Dọn dữ liệu cuối test.
- [ ] **Step 2: Chạy** spec (khoá test, seed) → PASS. **Mở xem từng ảnh 375px**: header không tràn, chuông ≥ 44px, tên GV cắt gọn, toast không che chuông, danh sách đọc được; ghi nhận xét ledger. Lỗi → sửa ở task gốc (`fix(ai): …`).
- [ ] **Step 3: Version + releases**, commit `chore: phat hanh 0.18.0`.
- [ ] **Step 4: Full test 1 lần**: `pnpm test` + e2e 2 nửa → PASS, ghi số vào ledger.
- [ ] **Step 5:** `DONE AI` lên kênh + báo cáo `.superpowers/claude-otd/bao-cao-AI.md` rồi dừng.
