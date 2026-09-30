# V — Đánh dấu đã gửi phiếu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự đánh dấu "đã gửi phiếu" khi Chia sẻ/Tải ảnh/Lưu ảnh, đánh dấu tay, nhãn "số tiền đã đổi", bộ lọc Phiếu báo.

**Architecture:** 2 cột trên `monthly_tuition`; mutation `tuition.setNoticeSent` tự tính số còn phải đóng ở server; `getMonthlyTuitionStatus` suy `noticeStatus` và lọc trong bộ nhớ; UI đọc DTO.

**Tech Stack:** Next.js 15, tRPC v11, Prisma 5.22, Vitest, Playwright, sonner (toast có action).

**Spec:** `docs/superpowers/specs/2026-10-01-v-da-gui-phieu-design.md`

## Global Constraints

- Nhánh `feat/v-da-gui-phieu` từ `main` **sau khi T đã merge**. Spec/plan đã trên main.
- Version `0.9.1` (patch). Migration `add_notice_sent` (thêm 2 cột NULL, không destructive), tạo `--create-only` trên `.env.test`.
- Toàn bộ ràng buộc an toàn DB / lệnh cấm / commit như plan T (Global Constraints).
- Số còn phải đóng = `max(0, totalAmountDue - paidAmount)` từ `getMonthlyTuitionStatus(..., persist=false, [studentId])`; `isFullPaid` → 0.

## Review Focus

1. Chia sẻ bị tự đóng (AbortError) không đánh dấu. Pin: Task 3 test.
2. Sau gửi mà điểm danh thêm / thu thêm → `changed`; gửi lại → `sent`. Pin: Task 1 test.
3. Em đã đóng đủ không vào "Chưa gửi". Pin: Task 2 test.
4. Tháng chưa có dòng → tạo đúng carry-over qua `ensureMonthlyTuition`. Pin: Task 1 test.
5. HS người khác → NOT_FOUND. Pin: Task 1 test.

---

### Task 1: Migration + mutation `setNoticeSent` + `noticeStatus`

**Files:** `prisma/schema.prisma` (`MonthlyTuition` thêm `noticeSentAt DateTime? @map("notice_sent_at")`, `noticeSentAmount Int? @map("notice_sent_amount")`), migration, `src/server/services/tuition.service.ts`, `src/server/trpc/routers/tuition.ts`, `src/lib/schemas/tuition.ts`, `src/lib/types/models.ts`
**Test:** `tests/integration/tuition-notice-sent.test.ts`

**Interfaces — Produces:**
```ts
export type NoticeStatus = "none" | "sent" | "changed"
// TuitionStatusDTO thêm: noticeSentAt: string | Date | null; noticeSentAmount: number | null; noticeStatus: NoticeStatus
export async function setNoticeSent(db, userId, input: { studentId: number; year: number; month: number; sent: boolean }): Promise<{ noticeSentAt: Date | null; noticeSentAmount: number | null }>
// router: tuition.setNoticeSent (protectedProcedure, không khoá gói)
```

- [ ] **Step 1: Tests**
  1. HS 1 buổi có mặt 100k tháng hiện tại, chưa có dòng `monthly_tuition` → `setNoticeSent(sent true)` → dòng được tạo, `previousBalance` đúng carry-over (có nợ tháng trước 50k → `noticeSentAmount 150000`); `getMonthlyStatus` → `noticeStatus "sent"`.
  2. Thêm 1 buổi có mặt → `noticeStatus "changed"`; `setNoticeSent(true)` lần nữa → `"sent"`, `noticeSentAmount` mới.
  3. Thu thêm 50k (`payment.create`) → `"changed"`.
  4. `setNoticeSent(false)` → `"none"`, 2 cột NULL.
  5. HS của `teacher2` → NOT_FOUND, không tạo dòng.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt** — migration; `setNoticeSent` dùng `ensureMonthlyTuition` rồi `getMonthlyTuitionStatus(db, userId, {studentId, year, month, status:"all", page:1, limit:1}, false, [studentId])` lấy item → `remaining = item.isFullPaid ? 0 : Math.max(0, item.totalAmountDue - item.paidAmount)` → update. Trong `getMonthlyTuitionStatus` item thêm `noticeSentAt`, `noticeSentAmount` từ snapshot và `noticeStatus` = `none` nếu `noticeSentAt` null, `sent` nếu `remaining === noticeSentAmount`, ngược lại `changed`. Upsert snapshot hiện có **không** được ghi đè 2 cột mới.
- [ ] **Step 3:** tests PASS; `pnpm test tests/integration/tuition*.test.ts` PASS.
- [ ] **Step 4: Commit** `feat(v): lưu đã gửi phiếu theo tháng, nhận biết số tiền đã đổi sau khi gửi`

### Task 2: Bộ lọc "Phiếu báo"

**Files:** `src/lib/schemas/tuition.ts` (`noticeFilter: z.enum(["all","unsent","sent"]).optional()`), `src/server/services/tuition.service.ts` (lọc cùng chỗ `status`), `src/app/(app)/tuition/page.tsx` (select trong `FilterBar`, tính vào `activeFilterCount`, giữ trên URL như bộ lọc khác nếu trang đang dùng URL params), `src/hooks/useFilters.ts` nếu cần.
**Test:** thêm vào `tests/integration/tuition-notice-sent.test.ts` + component/e2e ở Task 4.

- [ ] **Step 1: Test** — 3 HS: A đã gửi (sent), B chưa gửi còn nợ, C đã đóng đủ chưa gửi, D gửi rồi đổi số (changed) → `unsent` = [B, D]; `sent` = [A]; `all` = cả 4. Phân trang đúng sau lọc. Chạy → FAIL.
- [ ] **Step 2: Cài đặt** + select "Phiếu báo" (Tất cả / Chưa gửi / Đã gửi), key i18n `notice_filter`, `notice_unsent`, `notice_sent`.
- [ ] **Step 3:** PASS. **Commit** `feat(v): bộ lọc phiếu báo chưa gửi / đã gửi ở màn học phí`

### Task 3: Tự đánh dấu từ phiếu báo + đánh dấu tay + nhãn

**Files:** `src/components/tuition/TuitionNoticeDialog.tsx`, `src/lib/share-image.ts` (`shareOrDownloadPng` trả `"shared" | "downloaded" | "aborted"`), sheet học phí 1 HS, danh sách học phí (thẻ + bảng)
**Test:** `tests/unit/components/TuitionNoticeDialog.test.tsx`, `tests/unit/lib/share-image.test.ts`, component test nhãn danh sách

- [ ] **Step 1: Tests**
  - `shareOrDownloadPng`: share thành công → `"shared"`; AbortError → `"aborted"`; lỗi khác → tải file, `"downloaded"`.
  - Dialog: Tải ảnh → gọi `setNoticeSent({ sent: true })`; Chia sẻ `"shared"` → gọi; `"aborted"` → **không** gọi; mở "Lưu ảnh" (S3) → gọi. Toast có action "Hoàn tác" → gọi `sent: false`. Mutation lỗi → toast lỗi, không chặn.
  - Danh sách: `noticeStatus "sent"` + `noticeSentAt` → "Đã gửi 30/9"; `"changed"` → "Đã gửi · số tiền đã đổi" (màu cam); `"none"` → không có nhãn.
  - Sheet: nút "Đánh dấu đã gửi" khi none; "Bỏ đánh dấu" khi sent/changed; dòng "Phiếu báo: Đã gửi 30/9 lúc 20:15" (giờ VN).
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt** — sau mutation thành công `utils.tuition.getMonthlyStatus.invalidate()`. Ngày hiển thị qua dayjs tz VN (`src/lib/dayjs.ts`). Key i18n: `notice_sent_on` ("Đã gửi {d}"), `notice_changed` ("Đã gửi · số tiền đã đổi"), `notice_marked` ("Đã đánh dấu đã gửi phiếu"), `undo` (dùng sẵn nếu có), `mark_notice_sent`, `unmark_notice_sent`, `notice_sent_detail` ("Phiếu báo: Đã gửi {d} lúc {t}").
- [ ] **Step 3:** PASS; tsc, lint. **Commit** `feat(v): tự đánh dấu đã gửi khi chia sẻ/tải/lưu phiếu, nút đánh dấu tay, nhãn trong danh sách`

### Task 4: Version, e2e, hồi quy

- [ ] **Step 1: E2E `tests/e2e/v-da-gui-phieu.spec.ts`** (1280px + 390px): HS có tiền tháng này → mở phiếu báo → Tải ảnh (desktop) / Lưu ảnh (mobile) → đóng → danh sách hiện "Đã gửi"; lọc "Chưa gửi" không còn em đó; điểm danh thêm 1 buổi có mặt → nhãn "số tiền đã đổi" và em quay lại "Chưa gửi".
- [ ] **Step 2:** `package.json` → `0.9.1`.
- [ ] **Step 3:** Hồi quy full (tsc, lint, `pnpm test`, seed + full e2e).
- [ ] **Step 4: Commit** `chore(v): nâng version 0.9.1, e2e đã gửi phiếu`
- [ ] **Step 5:** Báo cáo `.superpowers/gehihi/bao-cao-V.md` + `DONE V` vào kênh.
