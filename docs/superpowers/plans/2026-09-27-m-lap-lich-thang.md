# M — Chép lịch dạy sang các tháng sau (theo lịch gốc) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở màn Lịch dạy có nút "Chép lịch tháng" (gói Plus/Pro): chọn tháng nguồn + 1–3 tháng đích liên tiếp → xem trước theo từng "mẫu tuần" suy ra từ lịch gốc (ca huỷ vẫn tính, ca bù không chép) → bấm Tạo → toàn bộ ca được tạo trong 1 transaction, chạy lại không tạo trùng.

**Architecture:** Hàm thuần `src/lib/copy-month.ts` (`deriveWeeklyPatterns`, `planMonthCopy`, `targetMonths`, tiện ích tháng/ngày) là nguồn duy nhất cho cả xem trước lẫn tạo. Service mới `src/server/services/session-copy.service.ts` đọc ca tháng nguồn + HS còn học + ca tháng đích rồi gọi hàm thuần; `copyMonth` chạy trong `$transaction` sau `pg_advisory_xact_lock` 2 khóa int4 và tính lại trùng bên trong transaction. 2 procedure mới `session.copyMonthPreview` (query) / `session.copyMonth` (mutation) đều là `planProcedure("copyMonth")`. UI: nút ở `CalendarToolbar` (khóa chứ không ẩn qua `useFeatureGate`), dialog mới `CopyMonthDialog`, nối ở `MonthCalendar`. Không migration.

**Tech Stack:** Next.js 15.5 App Router, React 19, tRPC v11 (không transformer: `Date` về client là chuỗi ISO → service trả ngày dạng chuỗi `YYYY-MM-DD`), @tanstack/react-query 5 (`keepPreviousData`), Prisma 5.22 + PostgreSQL, Zod 3, Tailwind 3.4, shadcn/ui (Radix Dialog/Select/Checkbox), sonner, Vitest 4 (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-m-lap-lich-thang-design.md` (U1–U5 người dùng đã chốt 2026-09-27; Q1–Q20 giữ nguyên). Chỗ plan lệch spec ghi ở mục "Điều chỉnh so với spec".

**Thứ tự với phần L:** L (bảng giá admin, `docs/superpowers/specs/2026-09-27-l-bang-gia-admin-design.md`) được code và merge vào `main` TRƯỚC M. L sửa `src/lib/plans.ts` (bỏ `PLAN_PRICES` → giá động, số ngày dùng thử động), khu admin, `PlanCompare`, `PlanPurchaseDialog`, `tests/unit/lib/plans.test.ts`, và dùng khóa advisory 2 tham số `SETTINGS_LOCK_CLASS = 7401`. M **không** phụ thuộc tên hằng số giá nào; M chỉ thêm 1 dòng vào `FEATURE_PLAN` và `PLAN_FEATURES`. Mọi mô tả `src/lib/plans.ts`, `/plan`, `plans.test.ts` trong plan này viết theo `main` lúc `00eace1` (trước L) → agent phải đối chiếu code thật; lệch thì theo code thật, giữ đúng hành vi spec M, ghi "Ruling: …" trong báo cáo task.

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **Không migration:** spec M không đổi `prisma/schema.prisma`, không tạo thư mục trong `prisma/migrations/`.
- **CẤM:** `db:reset`, `prisma migrate reset`, `prisma migrate dev`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm tra bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị của `.env.test`.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; **không** chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000, `playwright.config.ts` tự khởi `pnpm dev` với DB `.env.test`; `reuseExistingServer: false`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo người dùng. Trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trong `beforeAll`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng (`hidden md:block`) lẫn thẻ (`md:hidden`); lưới lịch desktop và lịch mini mobile cùng nằm trong DOM → lọc phần tử visible (`.filter({ visible: true })`) hoặc dùng test id.
- Tài khoản seed DB test (mật khẩu `teacher123`): `teacher`, `teacher2` (Pro tới 2099), `teacher_std` (Standard, không trial), `admin_test`. Không nhập credential nào khác vào trình duyệt; không ghi dữ liệu production.
- **Ngày giờ:** giờ VN (UTC+7) cho mọi phép tính "hôm nay"; dùng `vnDateParts` (`src/lib/utils.ts`). `sessionDate` là `Date.UTC(y, m-1, d)`, thứ lấy bằng `getUTCDay()`; giờ ca là chuỗi `HH:mm` qua `formatTime`/`parseTimeToDate` (`src/lib/utils.ts`). Server không dùng `getDate()`/`getDay()`/`dayjs()` giờ máy.
- **i18n:** `src/language/vi.json` và `en.json` cùng bộ key (`LanguageProvider` gõ `Record<Language, typeof vi>` nên `tsc` bắt thiếu key ở `en`). Chuỗi mới trong JSON không dùng gạch dài (—, –). Thay biến bằng `.replace("{x}", ...)` như code sẵn có.
- **Màu (A3):** nhấn `primary` (#0F766E), trung tính slate, cảnh báo amber, xung đột đỏ nhạt. **Không** indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass, không sửa file đó). Vùng chạm ≥44px trên mobile: `h-11 md:h-10` (nút icon `size-11`).
- `tests/unit/next15-contract.test.ts` đỏ nếu `page.tsx`/`layout.tsx` có định danh `params`/`searchParams` (kể cả trong comment). M không sửa `page.tsx`; nếu phải sửa thì đặt tên khác (vd `query`).
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy; không mô tả lại code.
- Làm trên nhánh `feat/m-chep-lich-thang` (Task 1 tạo từ `main` mới nhất SAU KHI L đã merge). **Không commit lên `main`. Agent thực hiện task KHÔNG merge, KHÔNG push.** Không `git stash`.
- **Thay đổi chưa commit của người khác:** lúc viết plan, working tree `main` có thay đổi chưa commit không thuộc M (vd `src/components/calendar/CalendarToolbar.tsx` đổi ô tìm kiếm sang `useDebouncedSearch`, `src/hooks/useDebouncedSearch.ts`, test tuition-search). Mỗi task chỉ `git add` đúng file của task. Nếu file task cần sửa đang có thay đổi chưa commit không phải của M → DỪNG, báo người dùng (không stash, không commit hộ, không ghi đè).
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit trên nhánh feature. Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Code lệch plan (vì code thật khác mô tả, nhất là sau khi L merge) → theo code thật, giữ đúng hành vi spec, ghi "Ruling: …" trong báo cáo task.

## Điều chỉnh so với spec

1. **`SourceSession`/`WeeklyPattern`/`CopyCandidate` có thêm `subjectName`** (spec 9.2 không có): hàm thuần cần tên môn để dựng nhãn xung đột giữa 2 ứng viên (`"title" (môn)` / `Lớp {môn} (HH:mm–HH:mm)`), giữ toàn bộ luật ở 1 chỗ. Nhãn dựng bằng `conflictLabel` (thuần, cùng định dạng `checkBulkCreateConflicts`).
2. **`WeeklyPattern.studentIds` đã lọc HS còn học + có `droppedInactive`**; `deriveWeeklyPatterns(sessions, year, month, activeStudentIds)` nhận `activeStudentIds` (spec 9.2 dòng cuối cho phép) nên `no_students` được gán trong hàm thuần, service không phân loại lại.
3. **`count` = số NGÀY khác nhau** của mẫu; cùng ngày có ca huỷ + ca dạy lại đúng slot thì "lần muộn nhất" là ca không huỷ (spec không nói; tránh lấy HS của ca đã huỷ).
4. **`planMonthCopy` trả thêm `selectedKeys` (mẫu thực sự được chọn) và `months`**; mỗi `MonthCount` có thêm `slots` (số ngày khớp thứ trong tháng, tính cho MỌI mẫu) để hàng mẫu chưa tích vẫn hiện "2/2030: 4". Hàng đã chọn hiện `created`.
5. **Xem trước trả ngày dạng chuỗi `YYYY-MM-DD`** (`lastDate`, `conflicts[].date`) vì tRPC không transformer.
6. **Không thêm key `copy_too_many`**: lỗi vượt trần là `TRPCError` tiếng Việt từ service ("Quá nhiều ca, hãy chọn ít tháng hơn"), dialog toast `err.message` như các lỗi service khác → key sẽ không được dùng.
7. **Key i18n mới ngoài bảng spec:** `copy_close` (repo không có key `close` như spec giả định), `copy_month_count` ("{month}: {count} ca"), `copy_student_count` ("{count} HS"). **`copy_empty` và `copy_view_month` dùng `{month}` = nhãn đầy đủ `month_year_label`** ("Tháng 1 / 2030") nên chuỗi vi là "{month} chưa có ca nào để chép" / "Xem {month}" (spec ghi "Tháng {month} …" sẽ thành "Tháng Tháng 1 / 2030").
8. **Tháng nguồn luôn có tháng đang xem** kể cả khi nằm ngoài khoảng [hiện tại − 12, hiện tại + 6] (spec 8.2): e2e xem 1/2030 thì tùy chọn vẫn có "Tháng 1 / 2030".
9. **`ExportExcelButton` thêm prop `className?`** (spec 8.1 cho phép): lưới 2 cột mobile cần `w-full h-11`; desktop giữ `md:h-9` như cũ.
10. **`CopyMonthDialog` mount có điều kiện** ở `MonthCalendar` (`{isCopyOpen && <CopyMonthDialog open … />}`) → state tự reset mỗi lần mở, không cần state `step` riêng (bước kết quả = `result !== null`).
11. **Khóa advisory `COPY_MONTH_LOCK_NS = 7402`** (7401 là `SETTINGS_LOCK_CLASS` của L). Task 3 grep `pg_advisory` để chắc không trùng.
12. **Nút Tạo khóa thêm khi xem trước chưa khớp lựa chọn** (`picked !== debouncedPicked`, đang fetch, hoặc đang hiện dữ liệu placeholder) → số "Tạo N ca" luôn là số server vừa tính cho đúng lựa chọn đang gửi.
13. Unit test schema đặt ở file mới `tests/unit/schemas/session-copy-month.schema.test.ts`; test gói thêm vào `PLUS_CASES` của `tests/integration/plan-gating.test.ts`.
14. Plan có 6 task.

## Review Focus

1. **Tháng nguồn có ca huỷ + ca dạy lại đúng slot cùng ngày** (giáo viên huỷ rồi tạo lại ca khác cùng giờ): mẫu phải đếm 1 ngày, lấy HS/title của ca không huỷ. Pin: unit Task 1 `tests/unit/lib/copy-month.test.ts` ("cùng ngày có ca huỷ + ca dạy lại").
2. **"Hôm nay" lúc 00:00–07:00 giờ VN** (UTC còn hôm trước): ngày hôm nay VN không bị tính `past`, hôm qua VN bị tính. Pin: unit Task 1 (`vnToday` + `planMonthCopy` past).
3. **Đang xem tháng ngoài khoảng chọn nguồn** (vd lịch đang ở 1/2030): dialog vẫn chọn sẵn đúng tháng đang xem, `from` = tháng sau. Pin: unit Task 4 `tests/unit/components/CopyMonthDialog.test.tsx`.
4. **Tích/bỏ tích rồi bấm Tạo ngay trong 300ms:** nút Tạo khóa tới khi xem trước tính lại; mutation gửi đúng các key đang tích. Pin: unit Task 4 cùng file.
5. **Gói hết hạn khi dialog đang mở / Standard:** query xem trước không gọi khi `!gate.allowed`; lỗi gói ở mutation → toast + đóng dialog; Standard bấm nút → `UpgradeDialog`, không có request `copyMonthPreview`. Pin: unit Task 4 + e2e Task 5 `tests/e2e/copy-month.spec.ts`.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/lib/copy-month.ts` | Mới | Hằng, kiểu, tiện ích tháng/ngày, `deriveWeeklyPatterns`, `planMonthCopy`, `conflictLabel`, `vnToday` | 1 |
| `tests/unit/lib/copy-month.test.ts` | Mới | Unit hàm thuần | 1 |
| `src/lib/schemas/session.ts` | Sửa | `sessionCopyMonthPreviewSchema`, `sessionCopyMonthSchema` + type | 2 |
| `tests/unit/schemas/session-copy-month.schema.test.ts` | Mới | Unit schema | 2 |
| `src/lib/plans.ts` | Sửa | `FEATURE_PLAN.copyMonth = "plus"`, dòng `PLAN_FEATURES` | 2 |
| `src/components/plan/feature-labels.ts` | Sửa | `copyMonth: "plan_feat_copy_month"` | 2 |
| `src/language/vi.json`, `en.json` | Sửa | `plan_feat_copy_month` (T2); key `copy_*` (T4) | 2, 4 |
| `tests/unit/lib/plans.test.ts` | Sửa | Thẻ Plus có `copyMonth` | 2 |
| `src/server/services/session-copy.service.ts` | Mới | `previewCopyMonth`, `copyMonth`, `COPY_MONTH_LOCK_NS` | 3 |
| `src/server/trpc/routers/session.ts` | Sửa | `copyMonthPreview`, `copyMonth` | 3 |
| `tests/integration/session-copy-month.test.ts` | Mới | Integration | 3 |
| `tests/integration/plan-gating.test.ts` | Sửa | 2 dòng `PLUS_CASES` | 3 |
| `src/components/sessions/CopyMonthDialog.tsx` | Mới | Dialog chọn tháng + xem trước + kết quả | 4 |
| `src/components/calendar/CalendarToolbar.tsx` | Sửa | Nút "Chép lịch tháng" + lưới 2 cột mobile | 4 |
| `src/components/reports/ExportExcelButton.tsx` | Sửa | Prop `className?` | 4 |
| `src/components/calendar/MonthCalendar.tsx` | Sửa | State mở dialog, `goToMonth` | 4 |
| `tests/unit/components/CopyMonthDialog.test.tsx` | Mới | Unit dialog | 4 |
| `tests/e2e/copy-month.spec.ts` | Mới | E2E desktop / mobile / khóa gói | 5 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → 3 → 4 → 5 → 6. T2 dùng `COPY_MONTH_MAX_MONTHS` (T1); T3 dùng hàm thuần (T1), schema + feature `copyMonth` (T2); T4 dùng procedure (T3) và key `plan_feat_copy_month` (T2); T5 dùng UI (T4).

---

### Task 1: Nhánh + commit spec/plan + hàm thuần `src/lib/copy-month.ts`

**Đọc trước:** Global Constraints; mục "Thứ tự với phần L"; spec mục 4 (4.2, 4.3), 5, 9.2, 12 (Unit `copy-month.test.ts`); `docs/coding-rule.md` §6.1; `src/lib/utils.ts` (`vnDateParts`, `formatTime`, `parseTimeToDate`); `src/server/services/session.service.ts` (`checkBulkCreateConflicts` dòng ~546: định dạng nhãn xung đột, quy ước `(getUTCDay() + 6) % 7`).

**Files:**
- Create: `src/lib/copy-month.ts`
- Test (Mới): `tests/unit/lib/copy-month.test.ts`
- Commit kèm: `docs/superpowers/specs/2026-09-27-m-lap-lich-thang-design.md`, `docs/superpowers/plans/2026-09-27-m-lap-lich-thang.md`

**Interfaces:**
- Consumes: `vnDateParts(now?: Date): { year; month; day }` từ `@/lib/utils`.
- Produces (mọi thứ export từ `@/lib/copy-month`):
  - Hằng: `COPY_MONTH_MAX_MONTHS = 3`, `COPY_MONTH_MAX_SESSIONS = 300`, `COPY_MONTH_WINDOW_DAYS = 14`.
  - `type MonthRef = { year: number; month: number }`
  - `type PatternKind = "regular" | "single" | "stopped" | "biweekly" | "no_students"`
  - `type SourceSession = { sessionDate: Date; startTime: string; endTime: string; subjectId: number; subjectName: string; title: string | null; status: string; makeupOfId: number | null; studentIds: number[] }`
  - `type WeeklyPattern = { key: string; weekday: number; startTime: string; endTime: string; subjectId: number; subjectName: string; title: string | null; studentIds: number[]; droppedInactive: number; count: number; lastDate: Date; kind: PatternKind }`
  - `type ExistingSession = { sessionDate: Date; startTime: string; endTime: string; status: string; label: string }`
  - `type CopyCandidate = { patternKey: string; sessionDate: Date; startTime: string; endTime: string; subjectId: number; subjectName: string; title: string | null; studentIds: number[] }`
  - `type MonthCount = { year: number; month: number; slots: number; created: number; existing: number; conflict: number; past: number }`
  - `type CopyConflict = { patternKey: string; date: string; conflict: string }` (`date` = `YYYY-MM-DD`)
  - `type CopyTotals = { created: number; existing: number; conflict: number; past: number }`
  - `type MonthCopyPlan = { selectedKeys: string[]; candidates: CopyCandidate[]; perPattern: Record<string, MonthCount[]>; months: { year: number; month: number; created: number }[]; conflicts: CopyConflict[]; totals: CopyTotals }`
  - `monthIndex(m: MonthRef): number`, `monthFromIndex(i: number): MonthRef`, `shiftMonth(m: MonthRef, n: number): MonthRef`, `targetMonths(from: MonthRef, months: number): MonthRef[]`
  - `weekdayOf(d: Date): number` (0 = T2 … 6 = CN), `ymd(d: Date): string`, `patternKey(weekday, startTime, endTime, subjectId): string`
  - `conflictLabel(title: string | null, subjectName: string, startTime: string, endTime: string): string`
  - `vnToday(now?: Date): Date` (`Date.UTC` của ngày VN)
  - `deriveWeeklyPatterns(sessions: SourceSession[], year: number, month: number, activeStudentIds: ReadonlySet<number>): WeeklyPattern[]`
  - `planMonthCopy(args: { patterns: WeeklyPattern[]; selectedKeys?: readonly string[]; targets: MonthRef[]; existing: ExistingSession[]; today: Date }): MonthCopyPlan`

- [ ] **Step 1: Tạo nhánh, commit spec + plan**

```bash
git fetch origin 2>/dev/null; git switch main
git log --oneline -8   # xác nhận commit merge của L ("feat: merge feat/l-…") đã có trên main; chưa có → DỪNG, báo người dùng
git status --short
git switch -c feat/m-chep-lich-thang
git status --short docs/superpowers/specs/2026-09-27-m-lap-lich-thang-design.md docs/superpowers/plans/2026-09-27-m-lap-lich-thang.md
```

Nếu 2 file trên còn untracked (`??`) thì commit; nếu L đã commit chúng thì bỏ qua lệnh commit dưới.

```bash
git add docs/superpowers/specs/2026-09-27-m-lap-lich-thang-design.md docs/superpowers/plans/2026-09-27-m-lap-lich-thang.md
git commit -m "docs(m): spec + plan chép lịch tháng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 2: Viết test đỏ `tests/unit/lib/copy-month.test.ts`**

Lịch tham chiếu (đã kiểm): 1/2030: T2 = 7,14,21,28; T3 = 1,8,15,22,29; T4 = 2,9,16,23,30; T5 = 3,10,17,24,31; T7 = 5,12,19,26. 2/2030: T2 = 4,11,18,25; T7 = 2,9,16,23. 3/2030: T2 = 4,11,18,25; T6 = 1,8,15,22,29. 11/2026 T2 = 2,9,16,23,30; 12/2026 T2 = 7,14,21,28; 1/2027 T2 = 4,11,18,25. 2/2028 (29 ngày) T3 = 1,8,15,22,29; 2/2027 (28 ngày) T2 = 1,8,15,22.

```ts
import { describe, it, expect } from "vitest"
import {
  conflictLabel,
  deriveWeeklyPatterns,
  monthFromIndex,
  monthIndex,
  planMonthCopy,
  shiftMonth,
  targetMonths,
  vnToday,
  weekdayOf,
  ymd,
  type ExistingSession,
  type SourceSession,
  type WeeklyPattern,
} from "@/lib/copy-month"

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)
const S = (date: string, start: string, end: string, o: Partial<SourceSession> = {}): SourceSession => ({
  sessionDate: D(date),
  startTime: start,
  endTime: end,
  subjectId: 1,
  subjectName: "Toán",
  title: null,
  status: "scheduled",
  makeupOfId: null,
  studentIds: [],
  ...o,
})
// Nhiều ca cùng giờ trong 1 tháng: days("2030-01", [7, 14], ...) → 2030-01-07, 2030-01-14.
const days = (ym: string, list: number[], start: string, end: string, o: Partial<SourceSession> = {}) =>
  list.map((d) => S(`${ym}-${String(d).padStart(2, "0")}`, start, end, o))
const ALL = new Set([1, 2, 3])
const kinds = (ps: WeeklyPattern[]) => ps.map((p) => [p.weekday, p.startTime, p.kind])

const P = (weekday: number, start: string, end: string, o: Partial<WeeklyPattern> = {}): WeeklyPattern => ({
  key: `${weekday}|${start}|${end}|1`,
  weekday,
  startTime: start,
  endTime: end,
  subjectId: 1,
  subjectName: "Toán",
  title: null,
  studentIds: [1],
  droppedInactive: 0,
  count: 4,
  lastDate: D("2030-01-28"),
  kind: "regular",
  ...o,
})
const E = (date: string, start: string, end: string, status = "scheduled", label = "Lớp Toán"): ExistingSession => ({
  sessionDate: D(date),
  startTime: start,
  endTime: end,
  status,
  label,
})
const FEB = [{ year: 2030, month: 2 }]
const EARLY = D("2020-01-01")
const dates = (plan: ReturnType<typeof planMonthCopy>) => plan.candidates.map((c) => ymd(c.sessionDate))

describe("tiện ích tháng / ngày", () => {
  it("monthIndex / monthFromIndex / shiftMonth cuộn năm", () => {
    expect(monthFromIndex(monthIndex({ year: 2030, month: 12 }))).toEqual({ year: 2030, month: 12 })
    expect(shiftMonth({ year: 2030, month: 12 }, 1)).toEqual({ year: 2031, month: 1 })
    expect(shiftMonth({ year: 2030, month: 1 }, -1)).toEqual({ year: 2029, month: 12 })
  })
  it("targetMonths: 1..3 tháng liên tiếp, qua năm", () => {
    expect(targetMonths({ year: 2030, month: 5 }, 1)).toEqual([{ year: 2030, month: 5 }])
    expect(targetMonths({ year: 2030, month: 11 }, 3)).toEqual([
      { year: 2030, month: 11 },
      { year: 2030, month: 12 },
      { year: 2031, month: 1 },
    ])
  })
  it("weekdayOf theo getUTCDay: 0 = T2 … 6 = CN", () => {
    expect(weekdayOf(D("2030-01-07"))).toBe(0)
    expect(weekdayOf(D("2030-01-06"))).toBe(6)
  })
  it("vnToday: 00:30 giờ VN ngày 1/2 (UTC còn 31/1) → 2030-02-01", () => {
    expect(ymd(vnToday(new Date("2030-01-31T17:30:00.000Z")))).toBe("2030-02-01")
    expect(ymd(vnToday(new Date("2030-01-31T16:59:00.000Z")))).toBe("2030-01-31")
  })
  it("conflictLabel cùng định dạng checkBulkCreateConflicts", () => {
    expect(conflictLabel("Nhóm A", "Toán", "17:00", "19:00")).toBe('"Nhóm A" (Toán)')
    expect(conflictLabel(null, "Toán", "17:00", "19:00")).toBe("Lớp Toán (17:00–19:00)")
  })
})

describe("deriveWeeklyPatterns (spec 4.2)", () => {
  it("4 tuần T2 + 5 tuần T4 → 2 mẫu regular, đúng key/giờ/count, sắp theo thứ", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [2, 9, 16, 23, 30], "08:00", "09:30", { subjectId: 2, subjectName: "Lý" }),
        ...days("2030-01", [7, 14, 21, 28], "17:00", "19:00"),
      ],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([
      [0, "17:00", "regular"],
      [2, "08:00", "regular"],
    ])
    expect(ps[0]).toMatchObject({ key: "0|17:00|19:00|1", endTime: "19:00", count: 4 })
    expect(ps[1]).toMatchObject({ key: "2|08:00|09:30|2", subjectName: "Lý", count: 5 })
    expect(ymd(ps[0].lastDate)).toBe("2030-01-28")
  })

  it("ca huỷ có ca bù vẫn góp vào mẫu gốc; ca bù (makeupOfId) không tạo mẫu", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 21, 28], "17:00", "19:00"),
        S("2030-01-14", "17:00", "19:00", { status: "cancelled" }),
        S("2030-01-18", "17:00", "19:00", { makeupOfId: 99 }),
      ],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([[0, "17:00", "regular"]])
    expect(ps[0].count).toBe(4)
  })

  it("ca huỷ không có ca bù (kể cả là lần cuối) vẫn tính", () => {
    const ps = deriveWeeklyPatterns(
      [...days("2030-01", [7, 14, 21], "17:00", "19:00"), S("2030-01-28", "17:00", "19:00", { status: "cancelled" })],
      2030,
      1,
      ALL
    )
    expect(ps[0]).toMatchObject({ kind: "regular", count: 4 })
    expect(ymd(ps[0].lastDate)).toBe("2030-01-28")
  })

  it("1 lần → single; đổi lịch giữa tháng (T3 tuần 1–2 → T5 tuần 3–5) → T3 stopped, T5 regular", () => {
    const ps = deriveWeeklyPatterns(
      [
        S("2030-01-26", "10:00", "11:00"),
        ...days("2030-01", [1, 8], "17:00", "19:00"),
        ...days("2030-01", [17, 24, 31], "17:00", "19:00"),
      ],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([
      [1, "17:00", "stopped"],
      [3, "17:00", "regular"],
      [5, "10:00", "single"],
    ])
  })

  it("cách tuần (2, 16, 30) → biweekly; lỡ 1 buổi (1, 8, 22, 29) → regular", () => {
    const ps = deriveWeeklyPatterns(
      [...days("2030-01", [2, 16, 30], "08:00", "09:00"), ...days("2030-01", [1, 8, 22, 29], "17:00", "19:00")],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([
      [1, "17:00", "regular"],
      [2, "08:00", "biweekly"],
    ])
  })

  it("đổi HS tuần cuối → studentIds + title lấy từ lần muộn nhất; không có notes", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 14, 21], "17:00", "19:00", { title: "Nhóm A", studentIds: [1] }),
        S("2030-01-28", "17:00", "19:00", { title: "Nhóm A2", studentIds: [1, 2] }),
      ],
      2030,
      1,
      ALL
    )
    expect(ps[0]).toMatchObject({ title: "Nhóm A2", studentIds: [1, 2], droppedInactive: 0 })
    expect("notes" in ps[0]).toBe(false)
  })

  it("HS lần cuối đều đã nghỉ → no_students; nghỉ 1 phần → giữ loại, bỏ HS nghỉ; ca không HS giữ loại", () => {
    const active = new Set([1, 2])
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 14, 21, 28], "17:00", "19:00", { studentIds: [3] }),
        ...days("2030-01", [7, 14, 21, 28], "19:00", "20:00", { studentIds: [1, 3] }),
        ...days("2030-01", [2, 9, 16, 23, 30], "08:00", "09:00"),
      ],
      2030,
      1,
      active
    )
    expect(ps.map((p) => [p.startTime, p.kind, p.studentIds, p.droppedInactive])).toEqual([
      ["17:00", "no_students", [], 1],
      ["19:00", "regular", [1], 1],
      ["08:00", "regular", [], 0],
    ])
  })

  it("tháng 2: cửa sổ 14 ngày tính theo ngày cuối thật (2028 nhuận 29 ngày, 2027 28 ngày)", () => {
    expect(kinds(deriveWeeklyPatterns(days("2028-02", [1, 8, 15], "17:00", "19:00"), 2028, 2, ALL))).toEqual([[1, "17:00", "stopped"]])
    expect(kinds(deriveWeeklyPatterns(days("2027-02", [1, 8, 15], "17:00", "19:00"), 2027, 2, ALL))).toEqual([[0, "17:00", "regular"]])
  })

  it("cùng ngày có ca huỷ + ca dạy lại đúng slot: đếm 1 ngày, lần muộn nhất là ca không huỷ", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 14, 21], "17:00", "19:00", { studentIds: [1] }),
        S("2030-01-28", "17:00", "19:00", { studentIds: [2] }),
        S("2030-01-28", "17:00", "19:00", { status: "cancelled", studentIds: [1] }),
      ],
      2030,
      1,
      ALL
    )
    expect(ps[0]).toMatchObject({ count: 4, studentIds: [2] })
  })
})

describe("planMonthCopy (spec 5)", () => {
  it("sinh đúng ngày theo thứ (T2 4 lần, T6 5 lần), không ra ngoài tháng, sắp theo ngày", () => {
    const mon = P(0, "17:00", "19:00")
    const fri = P(4, "08:00", "09:00")
    const plan = planMonthCopy({ patterns: [mon, fri], targets: [{ year: 2030, month: 3 }], existing: [], today: EARLY })
    expect(dates(plan)).toEqual([
      "2030-03-01", "2030-03-04", "2030-03-08", "2030-03-11", "2030-03-15",
      "2030-03-18", "2030-03-22", "2030-03-25", "2030-03-29",
    ])
    expect(plan.perPattern[mon.key]).toEqual([{ year: 2030, month: 3, slots: 4, created: 4, existing: 0, conflict: 0, past: 0 }])
    expect(plan.perPattern[fri.key][0]).toMatchObject({ slots: 5, created: 5 })
    expect(plan.months).toEqual([{ year: 2030, month: 3, created: 9 }])
    expect(plan.candidates[0]).toMatchObject({ patternKey: fri.key, startTime: "08:00", endTime: "09:00", subjectId: 1, studentIds: [1] })
  })

  it("cùng slot (kể cả ca huỷ) → existing; chồng giờ ca không huỷ → conflict có nhãn; ca huỷ khác giờ không chặn", () => {
    const mon = P(0, "17:00", "19:00")
    const plan = planMonthCopy({
      patterns: [mon],
      targets: FEB,
      existing: [
        E("2030-02-04", "17:00", "19:00", "cancelled"),
        E("2030-02-11", "17:30", "18:30", "scheduled", '"Ca tay" (Toán)'),
        E("2030-02-18", "16:00", "17:30", "cancelled"),
      ],
      today: EARLY,
    })
    expect(plan.totals).toEqual({ created: 2, existing: 1, conflict: 1, past: 0 })
    expect(plan.conflicts).toEqual([{ patternKey: mon.key, date: "2030-02-11", conflict: '"Ca tay" (Toán)' }])
    expect(dates(plan)).toEqual(["2030-02-18", "2030-02-25"])
  })

  it("2 mẫu được chọn chồng giờ cùng thứ → mẫu sắp sau bị conflict, nhãn theo mẫu trước", () => {
    const a = P(0, "17:00", "19:00", { title: "Nhóm A" })
    const b = P(0, "18:00", "20:00")
    const plan = planMonthCopy({ patterns: [a, b], selectedKeys: [a.key, b.key], targets: FEB, existing: [], today: EARLY })
    expect(plan.perPattern[a.key][0]).toMatchObject({ created: 4, conflict: 0 })
    expect(plan.perPattern[b.key][0]).toMatchObject({ created: 0, conflict: 4 })
    expect(plan.conflicts[0]).toEqual({ patternKey: b.key, date: "2030-02-04", conflict: '"Nhóm A" (Toán)' })
  })

  it("ngày trước hôm nay VN → past; đúng hôm nay vẫn tạo", () => {
    const plan = planMonthCopy({ patterns: [P(0, "17:00", "19:00")], targets: FEB, existing: [], today: D("2030-02-11") })
    expect(plan.totals).toEqual({ created: 3, existing: 0, conflict: 0, past: 1 })
    expect(dates(plan)).toEqual(["2030-02-11", "2030-02-18", "2030-02-25"])
  })

  it("nhiều tháng qua năm (11/2026 → 1/2027)", () => {
    const plan = planMonthCopy({
      patterns: [P(0, "17:00", "19:00")],
      targets: targetMonths({ year: 2026, month: 11 }, 3),
      existing: [],
      today: EARLY,
    })
    expect(plan.months).toEqual([
      { year: 2026, month: 11, created: 5 },
      { year: 2026, month: 12, created: 4 },
      { year: 2027, month: 1, created: 4 },
    ])
    expect(plan.totals.created).toBe(13)
  })

  it("không có selectedKeys → chỉ regular; có selectedKeys → đúng các key đó, key lạ bị bỏ; mẫu không chọn vẫn có slots", () => {
    const mon = P(0, "17:00", "19:00")
    const sat = P(5, "10:00", "11:00", { kind: "single", count: 1 })
    const byDefault = planMonthCopy({ patterns: [mon, sat], targets: FEB, existing: [], today: EARLY })
    expect(byDefault.selectedKeys).toEqual([mon.key])
    expect(byDefault.perPattern[sat.key][0]).toMatchObject({ slots: 4, created: 0 })
    const picked = planMonthCopy({ patterns: [mon, sat], selectedKeys: [sat.key, "9|00:00|01:00|1"], targets: FEB, existing: [], today: EARLY })
    expect(picked.selectedKeys).toEqual([sat.key])
    expect(dates(picked)).toEqual(["2030-02-02", "2030-02-09", "2030-02-16", "2030-02-23"])
    expect(picked.perPattern[mon.key][0]).toMatchObject({ slots: 4, created: 0 })
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `pnpm test tests/unit/lib/copy-month.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/copy-month"`.

- [ ] **Step 4: Viết `src/lib/copy-month.ts`**

```ts
// Thuần (không Prisma): xem trước và copyMonth dùng chung để số xem trước khớp đúng lúc tạo (spec M mục 4–5).
import { vnDateParts } from "@/lib/utils"

export const COPY_MONTH_MAX_MONTHS = 3
export const COPY_MONTH_MAX_SESSIONS = 300
export const COPY_MONTH_WINDOW_DAYS = 14
const BIWEEKLY_MIN_GAP = 14

export type MonthRef = { year: number; month: number }
export type PatternKind = "regular" | "single" | "stopped" | "biweekly" | "no_students"

export type SourceSession = {
  sessionDate: Date
  startTime: string
  endTime: string
  subjectId: number
  subjectName: string
  title: string | null
  status: string
  makeupOfId: number | null
  studentIds: number[]
}

export type WeeklyPattern = {
  key: string
  weekday: number
  startTime: string
  endTime: string
  subjectId: number
  subjectName: string
  title: string | null
  studentIds: number[]
  droppedInactive: number
  count: number
  lastDate: Date
  kind: PatternKind
}

export type ExistingSession = { sessionDate: Date; startTime: string; endTime: string; status: string; label: string }

export type CopyCandidate = {
  patternKey: string
  sessionDate: Date
  startTime: string
  endTime: string
  subjectId: number
  subjectName: string
  title: string | null
  studentIds: number[]
}

export type MonthCount = { year: number; month: number; slots: number; created: number; existing: number; conflict: number; past: number }
export type CopyConflict = { patternKey: string; date: string; conflict: string }
export type CopyTotals = { created: number; existing: number; conflict: number; past: number }
export type MonthCopyPlan = {
  selectedKeys: string[]
  candidates: CopyCandidate[]
  perPattern: Record<string, MonthCount[]>
  months: { year: number; month: number; created: number }[]
  conflicts: CopyConflict[]
  totals: CopyTotals
}

export const monthIndex = (m: MonthRef) => m.year * 12 + m.month - 1
export const monthFromIndex = (i: number): MonthRef => ({ year: Math.floor(i / 12), month: (i % 12) + 1 })
export const shiftMonth = (m: MonthRef, n: number) => monthFromIndex(monthIndex(m) + n)

export function targetMonths(from: MonthRef, months: number): MonthRef[] {
  return Array.from({ length: months }, (_, i) => shiftMonth(from, i))
}

export const weekdayOf = (d: Date) => (d.getUTCDay() + 6) % 7
export const ymd = (d: Date) => d.toISOString().slice(0, 10)
export const patternKey = (weekday: number, startTime: string, endTime: string, subjectId: number) =>
  `${weekday}|${startTime}|${endTime}|${subjectId}`

export function conflictLabel(title: string | null, subjectName: string, startTime: string, endTime: string): string {
  return title ? `"${title}" (${subjectName})` : `Lớp ${subjectName} (${startTime}–${endTime})`
}

export function vnToday(now: Date = new Date()): Date {
  const { year, month, day } = vnDateParts(now)
  return new Date(Date.UTC(year, month - 1, day))
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const cancelledFirst = (s: SourceSession) => (s.status === "cancelled" ? 0 : 1)

export function deriveWeeklyPatterns(
  sessions: SourceSession[],
  year: number,
  month: number,
  activeStudentIds: ReadonlySet<number>
): WeeklyPattern[] {
  const windowStart = daysIn(year, month) - COPY_MONTH_WINDOW_DAYS + 1
  const groups = new Map<string, SourceSession[]>()
  for (const s of sessions) {
    // Ca bù không phải lịch gốc (M2); ca huỷ vẫn nằm đúng slot gốc nên giữ.
    if (s.makeupOfId !== null) continue
    const key = patternKey(weekdayOf(s.sessionDate), s.startTime, s.endTime, s.subjectId)
    const list = groups.get(key)
    if (list) list.push(s)
    else groups.set(key, [s])
  }

  const out: WeeklyPattern[] = []
  for (const [key, list] of groups) {
    // Cùng ngày có ca huỷ + ca dạy lại đúng slot: ca không huỷ đứng sau để làm "lần muộn nhất".
    const sorted = [...list].sort(
      (a, b) => a.sessionDate.getTime() - b.sessionDate.getTime() || cancelledFirst(a) - cancelledFirst(b)
    )
    const latest = sorted[sorted.length - 1]
    const dayNums = [...new Set(sorted.map((s) => s.sessionDate.getUTCDate()))]
    const studentIds = latest.studentIds.filter((id) => activeStudentIds.has(id))

    let kind: PatternKind
    if (dayNums.length === 1) kind = "single"
    else if (dayNums[dayNums.length - 1] < windowStart) kind = "stopped"
    else if (dayNums.every((d, i) => i === 0 || d - dayNums[i - 1] >= BIWEEKLY_MIN_GAP)) kind = "biweekly"
    else kind = "regular"
    if (latest.studentIds.length > 0 && studentIds.length === 0) kind = "no_students"

    out.push({
      key,
      weekday: weekdayOf(latest.sessionDate),
      startTime: latest.startTime,
      endTime: latest.endTime,
      subjectId: latest.subjectId,
      subjectName: latest.subjectName,
      title: latest.title,
      studentIds,
      droppedInactive: latest.studentIds.length - studentIds.length,
      count: dayNums.length,
      lastDate: latest.sessionDate,
      kind,
    })
  }
  return out.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime) ||
      a.subjectId - b.subjectId
  )
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && aEnd > bStart

export function planMonthCopy(args: {
  patterns: WeeklyPattern[]
  selectedKeys?: readonly string[]
  targets: MonthRef[]
  existing: ExistingSession[]
  today: Date
}): MonthCopyPlan {
  const { patterns, targets, existing, today } = args
  const wanted = args.selectedKeys ? new Set(args.selectedKeys) : null
  const chosen = new Set(patterns.filter((p) => (wanted ? wanted.has(p.key) : p.kind === "regular")).map((p) => p.key))

  const perPattern: Record<string, MonthCount[]> = {}
  const slots: { p: WeeklyPattern; date: Date; count: MonthCount }[] = []
  for (const p of patterns) {
    perPattern[p.key] = targets.map((t) => {
      const count: MonthCount = { year: t.year, month: t.month, slots: 0, created: 0, existing: 0, conflict: 0, past: 0 }
      for (let d = 1; d <= daysIn(t.year, t.month); d++) {
        const date = new Date(Date.UTC(t.year, t.month - 1, d))
        if (weekdayOf(date) !== p.weekday) continue
        count.slots++
        if (chosen.has(p.key)) slots.push({ p, date, count })
      }
      return count
    })
  }
  slots.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.p.startTime.localeCompare(b.p.startTime) || a.p.key.localeCompare(b.p.key)
  )

  const candidates: CopyCandidate[] = []
  const conflicts: CopyConflict[] = []
  for (const { p, date, count } of slots) {
    if (date < today) {
      count.past++
      continue
    }
    const onDay = existing.filter((e) => e.sessionDate.getTime() === date.getTime())
    // Cùng slot kể cả ca huỷ → coi như đã có: chạy lại không hồi sinh ca giáo viên đã huỷ.
    if (onDay.some((e) => e.startTime === p.startTime && e.endTime === p.endTime)) {
      count.existing++
      continue
    }
    // Ca huỷ không chặn (khớp checkOverlap); ứng viên nhận trước cũng chặn ứng viên sau.
    const hit = onDay.find((e) => e.status !== "cancelled" && overlaps(p.startTime, p.endTime, e.startTime, e.endTime))
    const prev = hit
      ? undefined
      : candidates.find((c) => c.sessionDate.getTime() === date.getTime() && overlaps(p.startTime, p.endTime, c.startTime, c.endTime))
    const blocker = hit?.label ?? (prev && conflictLabel(prev.title, prev.subjectName, prev.startTime, prev.endTime))
    if (blocker) {
      count.conflict++
      conflicts.push({ patternKey: p.key, date: ymd(date), conflict: blocker })
      continue
    }
    count.created++
    candidates.push({
      patternKey: p.key,
      sessionDate: date,
      startTime: p.startTime,
      endTime: p.endTime,
      subjectId: p.subjectId,
      subjectName: p.subjectName,
      title: p.title,
      studentIds: p.studentIds,
    })
  }

  const all = Object.values(perPattern)
  const sum = (f: (c: MonthCount) => number) => all.reduce((s, list) => s + list.reduce((t, c) => t + f(c), 0), 0)
  return {
    selectedKeys: patterns.filter((p) => chosen.has(p.key)).map((p) => p.key),
    candidates,
    perPattern,
    months: targets.map((t, i) => ({ year: t.year, month: t.month, created: all.reduce((s, list) => s + list[i].created, 0) })),
    conflicts,
    totals: {
      created: sum((c) => c.created),
      existing: sum((c) => c.existing),
      conflict: sum((c) => c.conflict),
      past: sum((c) => c.past),
    },
  }
}
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `pnpm test tests/unit/lib/copy-month.test.ts`
Expected: PASS (toàn bộ test trong file).

- [ ] **Step 6: Kiểm tra kiểu + lint**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/lib/copy-month.ts tests/unit/lib/copy-month.test.ts
git commit -m "feat(m): hàm thuần suy lịch gốc và sinh ca chép tháng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Schema chép tháng + feature gói `copyMonth` (Plus)

**Đọc trước:** Global Constraints; mục "Thứ tự với phần L"; spec mục 9.1, 9.5, 11 (dòng `plan_feat_copy_month`), 12 (Schema, `plans.test.ts`); `src/lib/schemas/session.ts`; `src/lib/plans.ts` (**code thật sau L**: `FEATURE_PLAN`, `PLAN_FEATURES`); `src/components/plan/feature-labels.ts`; `tests/unit/lib/plans.test.ts` (khối `describe("PLAN_FEATURES …")`); `tests/unit/schemas/session.schema.test.ts` (văn phong).

**Files:**
- Modify: `src/lib/schemas/session.ts` (thêm schema cuối phần schema, thêm 2 type cuối file)
- Modify: `src/lib/plans.ts` (`FEATURE_PLAN`, `PLAN_FEATURES`)
- Modify: `src/components/plan/feature-labels.ts`
- Modify: `src/language/vi.json`, `src/language/en.json` (1 key)
- Test (Mới): `tests/unit/schemas/session-copy-month.schema.test.ts`
- Test (Sửa): `tests/unit/lib/plans.test.ts`

**Interfaces:**
- Consumes: `COPY_MONTH_MAX_MONTHS` từ `@/lib/copy-month` (Task 1).
- Produces:
  - `sessionCopyMonthPreviewSchema`: `{ source: { year; month }; from: { year; month }; months: 1..3; patternKeys?: string[] (mỗi chuỗi ≤ 40, tối đa 200) }`, refine `source < from ≤ source + 12` (lỗi ở path `["from"]`).
  - `sessionCopyMonthSchema`: như trên nhưng `patternKeys` bắt buộc, `min(1)`.
  - `type SessionCopyMonthPreviewInput`, `type SessionCopyMonthInput`.
  - `FEATURE_PLAN.copyMonth === "plus"`; `Feature` có `"copyMonth"`; `PLAN_FEATURES` có `{ id: "copyMonth", plan: FEATURE_PLAN.copyMonth }` ngay sau dòng `monthlyReport` → `featuresAddedIn("plus")` kết thúc bằng `"copyMonth"`.
  - `FEATURE_LABEL_KEY.copyMonth = "plan_feat_copy_month"`; key i18n `plan_feat_copy_month`.

- [ ] **Step 1: Viết test đỏ `tests/unit/schemas/session-copy-month.schema.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { sessionCopyMonthPreviewSchema, sessionCopyMonthSchema } from "@/lib/schemas/session"

const base = { source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1 }

describe("sessionCopyMonthPreviewSchema", () => {
  it("✓ hợp lệ, patternKeys không bắt buộc, được rỗng", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse(base).success).toBe(true)
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, patternKeys: [] }).success).toBe(true)
  })
  it("✓ from = source + 12, qua năm", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, source: { year: 2030, month: 11 }, from: { year: 2031, month: 11 } }).success).toBe(true)
  })
  it("✗ from ≤ source", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, from: { year: 2030, month: 1 } }).success).toBe(false)
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, from: { year: 2029, month: 12 } }).success).toBe(false)
  })
  it("✗ from > source + 12", () => {
    const r = sessionCopyMonthPreviewSchema.safeParse({ ...base, from: { year: 2031, month: 2 } })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(["from"])
  })
  it("✗ months = 0 hoặc 4", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, months: 0 }).success).toBe(false)
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, months: 4 }).success).toBe(false)
  })
  it("✗ key dài quá 40 ký tự", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, patternKeys: ["x".repeat(41)] }).success).toBe(false)
  })
})

describe("sessionCopyMonthSchema", () => {
  it("✓ có ít nhất 1 key", () => {
    expect(sessionCopyMonthSchema.safeParse({ ...base, patternKeys: ["0|17:00|19:00|1"] }).success).toBe(true)
  })
  it("✗ thiếu patternKeys hoặc patternKeys rỗng", () => {
    expect(sessionCopyMonthSchema.safeParse(base).success).toBe(false)
    expect(sessionCopyMonthSchema.safeParse({ ...base, patternKeys: [] }).success).toBe(false)
  })
  it("✗ cùng luật tháng như xem trước", () => {
    expect(sessionCopyMonthSchema.safeParse({ ...base, from: { year: 2030, month: 1 }, patternKeys: ["k"] }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Sửa test `tests/unit/lib/plans.test.ts`** (khối `describe("PLAN_FEATURES …")`, test "thẻ Standard / Plus / Pro")

Đổi dòng kỳ vọng thẻ Plus và thêm 1 dòng (nếu sau L dòng này đã khác thì chỉ thêm `"copyMonth"` vào cuối danh sách Plus đang có, ghi Ruling):

```ts
    expect(featuresAddedIn("plus")).toEqual(["payments", "tuitionNotice", "monthlyReport", "copyMonth"])
    expect(FEATURE_PLAN.copyMonth).toBe("plus")
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `pnpm test tests/unit/schemas/session-copy-month.schema.test.ts`
Expected: FAIL — `sessionCopyMonthPreviewSchema` undefined (`Cannot read properties of undefined (reading 'safeParse')`).

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: FAIL ở "thẻ Standard / Plus / Pro" (thiếu `copyMonth`).

- [ ] **Step 4: Thêm schema vào `src/lib/schemas/session.ts`**

Thêm import đầu file và khối schema ngay sau `sessionCreateMakeupSchema`:

```ts
import { COPY_MONTH_MAX_MONTHS } from "@/lib/copy-month"
```

```ts
const monthRefSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})
const copyMonthBase = z.object({
  source: monthRefSchema,
  from: monthRefSchema,
  months: z.number().int().min(1).max(COPY_MONTH_MAX_MONTHS),
})
const monthNo = (m: { year: number; month: number }) => m.year * 12 + m.month
const fromAfterSource = (d: z.infer<typeof copyMonthBase>) =>
  monthNo(d.from) > monthNo(d.source) && monthNo(d.from) <= monthNo(d.source) + 12
const FROM_RULE = { message: "Tháng bắt đầu phải sau tháng nguồn, tối đa 12 tháng", path: ["from"] }
const patternKeySchema = z.string().max(40)

// Không có patternKeys = server chọn mặc định theo loại mẫu (chỉ "regular").
export const sessionCopyMonthPreviewSchema = copyMonthBase
  .extend({ patternKeys: z.array(patternKeySchema).max(200).optional() })
  .refine(fromAfterSource, FROM_RULE)

export const sessionCopyMonthSchema = copyMonthBase
  .extend({ patternKeys: z.array(patternKeySchema).min(1).max(200) })
  .refine(fromAfterSource, FROM_RULE)
```

Cuối file (cạnh các type khác):

```ts
export type SessionCopyMonthPreviewInput = z.infer<typeof sessionCopyMonthPreviewSchema>
export type SessionCopyMonthInput = z.infer<typeof sessionCopyMonthSchema>
```

- [ ] **Step 5: Thêm feature `copyMonth` vào `src/lib/plans.ts`**

Đối chiếu code thật sau L trước khi sửa. Theo `main` `00eace1`:

```ts
export const FEATURE_PLAN = {
  payments: "plus",
  tuitionNotice: "plus",
  monthlyReport: "plus",
  copyMonth: "plus",
  parentLink: "pro",
  dashboardAlerts: "pro",
  studentImport: "pro",
  multiMonthReport: "pro",
} as const satisfies Record<string, PaidPlan>
```

Trong `PLAN_FEATURES`, ngay sau dòng `{ id: "monthlyReport", plan: FEATURE_PLAN.monthlyReport },`:

```ts
  { id: "copyMonth", plan: FEATURE_PLAN.copyMonth },
```

- [ ] **Step 6: Nhãn + i18n**

`src/components/plan/feature-labels.ts`, sau `monthlyReport: "plan_feat_monthly_report",`:

```ts
  copyMonth: "plan_feat_copy_month",
```

`src/language/vi.json`, ngay sau dòng `"plan_feat_monthly_report": …`:

```json
  "plan_feat_copy_month": "Chép lịch sang tháng sau (tối đa 3 tháng)",
```

`src/language/en.json`, ngay sau dòng `"plan_feat_monthly_report": …`:

```json
  "plan_feat_copy_month": "Copy schedule to next months (up to 3)",
```

- [ ] **Step 7: Chạy test, xác nhận xanh**

Run: `pnpm test tests/unit/schemas/session-copy-month.schema.test.ts`
Expected: PASS.

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: PASS (kể cả "mọi tính năng bị chặn quyền có trong danh sách…").

Run: `pnpm test tests/unit/components/PlanCompare.test.tsx`
Expected: PASS (nếu đỏ vì đếm số dòng tính năng thẻ Plus → cập nhật kỳ vọng thêm dòng "Chép lịch sang tháng sau (tối đa 3 tháng)", ghi Ruling).

- [ ] **Step 8: Kiểm tra kiểu + lint**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add src/lib/schemas/session.ts src/lib/plans.ts src/components/plan/feature-labels.ts src/language/vi.json src/language/en.json tests/unit/schemas/session-copy-month.schema.test.ts tests/unit/lib/plans.test.ts
git commit -m "feat(m): schema chép lịch tháng + tính năng gói copyMonth (Plus)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Service `session-copy.service.ts` + procedure `copyMonthPreview` / `copyMonth`

**Đọc trước:** Global Constraints; spec mục 4.4, 5.2, 6 (Q10–Q13, Q20), 9.3, 9.4, 10, 12 (Integration); `docs/coding-rule.md` §6.1; `src/lib/copy-month.ts` (Task 1); `src/lib/schemas/session.ts` (Task 2); `src/server/services/session.service.ts` (`bulkCreateSessions` dòng ~602: `createManyAndReturn` + `sessionStudent.createMany`); `src/server/services/plan.service.ts` (dòng ~181: advisory lock trong `$transaction`; `type Db`); `src/server/trpc/index.ts` (`planProcedure`); `src/server/trpc/routers/session.ts`; `tests/integration/plan-gating.test.ts`; `tests/helpers/trpc.ts`.

**Files:**
- Create: `src/server/services/session-copy.service.ts`
- Modify: `src/server/trpc/routers/session.ts`
- Test (Mới): `tests/integration/session-copy-month.test.ts`
- Test (Sửa): `tests/integration/plan-gating.test.ts` (thêm 2 dòng vào `PLUS_CASES`)

**Interfaces:**
- Consumes: mọi export của `@/lib/copy-month` (Task 1); `sessionCopyMonthPreviewSchema`, `sessionCopyMonthSchema`, `SessionCopyMonthPreviewInput`, `SessionCopyMonthInput` (Task 2); `planProcedure(feature: Feature)`; `formatTime`, `parseTimeToDate` (`@/lib/utils`).
- Produces:
  - `COPY_MONTH_LOCK_NS = 7402`
  - `previewCopyMonth(db: PrismaClient, userId: number, input: SessionCopyMonthPreviewInput): Promise<CopyMonthPreview>` với
    ```ts
    type CopyMonthPreview = {
      patterns: {
        key: string; weekday: number; startTime: string; endTime: string
        subject: { id: number; name: string; color: string }
        title: string | null; studentCount: number; droppedInactive: number
        kind: PatternKind; lastDate: string /* YYYY-MM-DD */; selected: boolean
        perMonth: MonthCount[]
      }[]
      months: { year: number; month: number; created: number }[]
      totals: CopyTotals
      conflicts: CopyConflict[] // tối đa 50
    }
    ```
  - `copyMonth(db: PrismaClient, userId: number, input: SessionCopyMonthInput): Promise<{ created: number; months: { year: number; month: number; created: number }[]; skipped: { existing: number; conflict: number; past: number } }>`
  - tRPC: `session.copyMonthPreview` (query), `session.copyMonth` (mutation), cả hai `planProcedure("copyMonth")`. Client đọc kiểu qua `RouterOutputs["session"]["copyMonthPreview"]` / `["copyMonth"]`.
  - Lỗi: `BAD_REQUEST` "Không có mẫu lịch hợp lệ để chép" (không key nào khớp mẫu), `BAD_REQUEST` "Quá nhiều ca, hãy chọn ít tháng hơn" (> 300 ca, kiểm trước khi ghi).

- [ ] **Step 1: Xác nhận không trùng khóa advisory**

Run: `git grep -n "pg_advisory\|LOCK_CLASS\|LOCK_NS" -- src`
Expected: chỉ thấy khóa bigint `BigInt(userId)` và `SETTINGS_LOCK_CLASS = 7401` (của L). Nếu `7402` đã được dùng → chọn số chưa dùng, ghi Ruling.

- [ ] **Step 2: Viết test đỏ `tests/integration/session-copy-month.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { TRPCError } from "@trpc/server"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { formatTime, parseTimeToDate } from "@/lib/utils"

// Tháng xa để không dính "ngày đã qua".
const D = (s: string) => new Date(`${s}T00:00:00.000Z`)
const SRC = { year: 2030, month: 1 }
const FEB = { year: 2030, month: 2 }

let uid = 0
let uid2 = 0
let subjectId = 0
let subject2Id = 0
let stA = 0
let stB = 0
let stC = 0
let st2 = 0
const monKey = () => `0|17:00|19:00|${subjectId}`

type MkOpts = { status?: string; makeupOfId?: number; title?: string; notes?: string; studentIds?: number[] }
async function mk(userId: number, subject: number, date: string, start: string, end: string, o: MkOpts = {}) {
  return db.teachingSession.create({
    data: {
      userId,
      subjectId: subject,
      sessionDate: D(date),
      startTime: parseTimeToDate(start),
      endTime: parseTimeToDate(end),
      title: o.title ?? null,
      notes: o.notes ?? null,
      status: o.status ?? "scheduled",
      makeupOfId: o.makeupOfId ?? null,
      sessionStudents: { create: (o.studentIds ?? []).map((studentId) => ({ studentId, fee: 1, grade: 1 })) },
    },
  })
}

// 1/2030 của teacher: T2 17–19 (14 huỷ + bù T6 18/1; 28 là lần cuối có HS A, B, C(nghỉ)), T4 08–09:30 chỉ HS C → no_students, T7 26 lẻ.
async function seedSource() {
  await mk(uid, subjectId, "2030-01-07", "17:00", "19:00", { title: "Nhóm A", studentIds: [stA] })
  const cancelled = await mk(uid, subjectId, "2030-01-14", "17:00", "19:00", { title: "Nhóm A", status: "cancelled", studentIds: [stA] })
  await mk(uid, subjectId, "2030-01-18", "17:00", "19:00", { title: "Bù", makeupOfId: cancelled.id, studentIds: [stA] })
  await mk(uid, subjectId, "2030-01-21", "17:00", "19:00", { title: "Nhóm A", studentIds: [stA] })
  await mk(uid, subjectId, "2030-01-28", "17:00", "19:00", { title: "Nhóm A2", notes: "ôn chương 3", studentIds: [stA, stB, stC] })
  for (const d of ["02", "09", "16", "23", "30"]) {
    await mk(uid, subjectId, `2030-01-${d}`, "08:00", "09:30", { studentIds: [stC] })
  }
  await mk(uid, subjectId, "2030-01-26", "10:00", "11:00")
}

const countFrom = (userId: number, from: string) =>
  db.teachingSession.count({ where: { userId, sessionDate: { gte: D(from) } } })

async function errorOf(p: Promise<unknown>): Promise<TRPCError> {
  const e = await p.then(() => null, (err: unknown) => err)
  expect(e).toBeInstanceOf(TRPCError)
  return e as TRPCError
}

describe("session.copyMonthPreview / copyMonth (spec M)", () => {
  beforeAll(async () => {
    uid = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
    uid2 = (await db.user.findUniqueOrThrow({ where: { username: "teacher2" } })).id
    subjectId = (await db.subject.create({ data: { userId: uid, name: "Toán M", color: "#0891B2" } })).id
    subject2Id = (await db.subject.create({ data: { userId: uid2, name: "Văn M", color: "#0891B2" } })).id
    stA = (await db.student.create({ data: { userId: uid, fullName: "HS A chép", grade: 5, tuitionFee: 100000 } })).id
    stB = (await db.student.create({ data: { userId: uid, fullName: "HS B chép", grade: 4, tuitionFee: 80000 } })).id
    stC = (await db.student.create({ data: { userId: uid, fullName: "HS C nghỉ", grade: 3, tuitionFee: 50000, isActive: false } })).id
    st2 = (await db.student.create({ data: { userId: uid2, fullName: "HS của teacher2", grade: 5, tuitionFee: 90000 } })).id
  })

  beforeEach(async () => {
    await db.teachingSession.deleteMany({ where: { userId: { in: [uid, uid2] } } })
    await db.student.update({ where: { id: stA }, data: { tuitionFee: 100000, grade: 5 } })
  })

  afterAll(async () => {
    await db.teachingSession.deleteMany({ where: { userId: { in: [uid, uid2] } } })
    await db.student.deleteMany({ where: { id: { in: [stA, stB, stC, st2] } } })
    await db.subject.deleteMany({ where: { id: { in: [subjectId, subject2Id] } } })
  })

  it("xem trước mặc định: ca bù không thành mẫu, chỉ regular chọn sẵn, bỏ HS đã nghỉ", async () => {
    await seedSource()
    const p = await (await getAuthedCaller("teacher")).session.copyMonthPreview({ source: SRC, from: FEB, months: 1 })
    expect(p.patterns.map((x) => [x.weekday, x.startTime, x.kind, x.selected])).toEqual([
      [0, "17:00", "regular", true],
      [2, "08:00", "no_students", false],
      [5, "10:00", "single", false],
    ])
    expect(p.patterns[0]).toMatchObject({
      key: monKey(),
      title: "Nhóm A2",
      studentCount: 2,
      droppedInactive: 1,
      lastDate: "2030-01-28",
      subject: { id: subjectId, name: "Toán M", color: "#0891B2" },
      perMonth: [{ year: 2030, month: 2, slots: 4, created: 4, existing: 0, conflict: 0, past: 0 }],
    })
    expect(p.totals).toEqual({ created: 4, existing: 0, conflict: 0, past: 0 })
    expect(p.months).toEqual([{ year: 2030, month: 2, created: 4 }])
    expect(p.conflicts).toEqual([])
  })

  it("copyMonth 1 tháng: đúng thứ, HS còn học, fee/grade hiện tại, pending, không notes, không phải ca bù", async () => {
    await seedSource()
    await db.student.update({ where: { id: stA }, data: { tuitionFee: 150000, grade: 6 } })
    const res = await (await getAuthedCaller("teacher")).session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey()] })
    expect(res).toEqual({ created: 4, months: [{ year: 2030, month: 2, created: 4 }], skipped: { existing: 0, conflict: 0, past: 0 } })

    const rows = await db.teachingSession.findMany({
      where: { userId: uid, sessionDate: { gte: D("2030-02-01"), lt: D("2030-03-01") } },
      include: { sessionStudents: true },
      orderBy: { sessionDate: "asc" },
    })
    expect(rows.map((r) => r.sessionDate.toISOString().slice(0, 10))).toEqual(["2030-02-04", "2030-02-11", "2030-02-18", "2030-02-25"])
    for (const r of rows) {
      expect(r).toMatchObject({ subjectId, title: "Nhóm A2", notes: null, status: "scheduled", makeupOfId: null, cancelReason: null })
      expect([formatTime(r.startTime), formatTime(r.endTime)]).toEqual(["17:00", "19:00"])
      expect(r.sessionStudents.map((s) => s.studentId).sort((a, b) => a - b)).toEqual([stA, stB].sort((a, b) => a - b))
      expect(r.sessionStudents.find((s) => s.studentId === stA)).toMatchObject({ attendance: "pending", fee: 150000, grade: 6 })
      expect(r.sessionStudents.find((s) => s.studentId === stB)).toMatchObject({ attendance: "pending", fee: 80000, grade: 4 })
    }
  })

  it("idempotent: chạy lại không tạo trùng; ca đã chép bị huỷ không hồi sinh", async () => {
    await seedSource()
    const c = await getAuthedCaller("teacher")
    const input = { source: SRC, from: FEB, months: 1, patternKeys: [monKey()] }
    await c.session.copyMonth(input)
    expect(await c.session.copyMonth(input)).toMatchObject({ created: 0, skipped: { existing: 4, conflict: 0, past: 0 } })
    const first = await db.teachingSession.findFirstOrThrow({ where: { userId: uid, sessionDate: D("2030-02-04") } })
    await db.teachingSession.update({ where: { id: first.id }, data: { status: "cancelled", cancelledAt: new Date() } })
    expect((await c.session.copyMonth(input)).created).toBe(0)
    expect(await countFrom(uid, "2030-02-01")).toBe(4)
  })

  it("ca tay chồng giờ ở tháng đích → conflict, ca tay giữ nguyên; ca huỷ khác giờ không chặn", async () => {
    await seedSource()
    const manual = await mk(uid, subjectId, "2030-02-11", "17:30", "18:30", { title: "Ca tay" })
    await mk(uid, subjectId, "2030-02-18", "16:00", "17:30", { status: "cancelled" })
    const c = await getAuthedCaller("teacher")
    const p = await c.session.copyMonthPreview({ source: SRC, from: FEB, months: 1 })
    expect(p.totals).toEqual({ created: 3, existing: 0, conflict: 1, past: 0 })
    expect(p.conflicts).toEqual([{ patternKey: monKey(), date: "2030-02-11", conflict: '"Ca tay" (Toán M)' }])
    expect((await c.session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey()] })).created).toBe(3)
    expect(await db.teachingSession.findUniqueOrThrow({ where: { id: manual.id } })).toMatchObject({ title: "Ca tay", status: "scheduled" })
  })

  it("3 tháng qua năm (11/2030 → 1/2031): đúng từng tháng", async () => {
    await seedSource()
    const res = await (await getAuthedCaller("teacher")).session.copyMonth({
      source: SRC,
      from: { year: 2030, month: 11 },
      months: 3,
      patternKeys: [monKey()],
    })
    expect(res.months).toEqual([
      { year: 2030, month: 11, created: 4 },
      { year: 2030, month: 12, created: 5 },
      { year: 2031, month: 1, created: 4 },
    ])
    expect(res.created).toBe(13)
  })

  it("2 request song song chỉ tạo 1 lần (khóa advisory + tính lại trong transaction)", async () => {
    await seedSource()
    const c = await getAuthedCaller("teacher")
    const input = { source: SRC, from: FEB, months: 1, patternKeys: [monKey()] }
    const [a, b] = await Promise.all([c.session.copyMonth(input), c.session.copyMonth(input)])
    expect([a.created, b.created].sort((x, y) => x - y)).toEqual([0, 4])
    expect(await countFrom(uid, "2030-02-01")).toBe(4)
  })

  it("vượt 300 ca → BAD_REQUEST trước khi ghi, không có ca nào được tạo", async () => {
    const data = []
    for (const day of ["07", "14", "21", "28", "01", "08", "15", "22", "29"]) {
      for (let h = 6; h < 22; h++) {
        const hh = String(h).padStart(2, "0")
        data.push({ userId: uid, subjectId, sessionDate: D(`2030-01-${day}`), startTime: parseTimeToDate(`${hh}:00`), endTime: parseTimeToDate(`${hh}:50`) })
      }
    }
    await db.teachingSession.createMany({ data })
    const c = await getAuthedCaller("teacher")
    const p = await c.session.copyMonthPreview({ source: SRC, from: FEB, months: 3 })
    expect(p.totals.created).toBe(416)
    const err = await errorOf(c.session.copyMonth({ source: SRC, from: FEB, months: 3, patternKeys: p.patterns.map((x) => x.key) }))
    expect(err.code).toBe("BAD_REQUEST")
    expect(err.message).toBe("Quá nhiều ca, hãy chọn ít tháng hơn")
    expect(await countFrom(uid, "2030-02-01")).toBe(0)
  })

  it("key lạ bị bỏ qua; toàn key lạ → BAD_REQUEST", async () => {
    await seedSource()
    const c = await getAuthedCaller("teacher")
    const ok = await c.session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey(), "6|23:00|23:30|999999"] })
    expect(ok.created).toBe(4)
    const err = await errorOf(c.session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: ["6|23:00|23:30|999999"] }))
    expect(err.code).toBe("BAD_REQUEST")
    expect(err.message).toBe("Không có mẫu lịch hợp lệ để chép")
  })

  it("multi-tenant: ca/HS của user khác không kéo vào, không gây existing/conflict", async () => {
    await seedSource()
    await mk(uid2, subject2Id, "2030-02-04", "17:00", "19:00", { studentIds: [st2] })
    const res = await (await getAuthedCaller("teacher")).session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey()] })
    expect(res).toMatchObject({ created: 4, skipped: { existing: 0, conflict: 0, past: 0 } })
    const p2 = await (await getAuthedCaller("teacher2")).session.copyMonthPreview({ source: SRC, from: FEB, months: 1 })
    expect(p2.patterns).toEqual([])
    const links = await db.sessionStudent.findMany({ where: { session: { userId: uid } }, select: { studentId: true } })
    expect(links.some((l) => l.studentId === st2)).toBe(false)
  })
})
```

Số 416 = 16 khung giờ × (T2: 4 + 4 + 5 buổi ở 2–4/2030) + 16 × (T3: 4 + 4 + 5) (lịch đã kiểm ở Task 1).

- [ ] **Step 3: Thêm 2 dòng vào `PLUS_CASES` của `tests/integration/plan-gating.test.ts`**

Cuối mảng `PLUS_CASES` (sau dòng `report.student 1 tháng`):

```ts
  ["session.copyMonthPreview", (c) => c.session.copyMonthPreview({ source: { year: 2031, month: 1 }, from: { year: 2031, month: 2 }, months: 1 })],
  ["session.copyMonth", (c) => c.session.copyMonth({ source: { year: 2031, month: 1 }, from: { year: 2031, month: 2 }, months: 1, patternKeys: ["0|17:00|19:00|999999"] })],
```

(Standard → `FORBIDDEN` + `planRequired = "plus"`; Plus/Pro → qua chốt: preview trả dữ liệu rỗng, mutation ra `BAD_REQUEST` chứ không `FORBIDDEN`.)

- [ ] **Step 4: Chạy test, xác nhận đỏ**

Run: `pnpm test tests/integration/session-copy-month.test.ts`
Expected: FAIL — `c.session.copyMonthPreview is not a function` (hoặc lỗi kiểu tương đương: procedure chưa có).

- [ ] **Step 5: Viết `src/server/services/session-copy.service.ts`**

```ts
import { TRPCError } from "@trpc/server"
import type { Prisma, PrismaClient } from "@prisma/client"
import { formatTime, parseTimeToDate } from "@/lib/utils"
import {
  COPY_MONTH_MAX_SESSIONS,
  conflictLabel,
  deriveWeeklyPatterns,
  planMonthCopy,
  targetMonths,
  vnToday,
  ymd,
  type ExistingSession,
  type MonthRef,
  type SourceSession,
} from "@/lib/copy-month"
import type { SessionCopyMonthInput, SessionCopyMonthPreviewInput } from "@/lib/schemas/session"

type Db = PrismaClient | Prisma.TransactionClient
type CopyRange = { source: MonthRef; from: MonthRef; months: number }

// Dạng 2 khóa int4 để không chung khóa bigint userId của plan/student; 7401 là khóa bảng giá (L).
export const COPY_MONTH_LOCK_NS = 7402
const MAX_PREVIEW_CONFLICTS = 50

const monthStart = (m: MonthRef) => new Date(Date.UTC(m.year, m.month - 1, 1))
const nextMonthStart = (m: MonthRef) => new Date(Date.UTC(m.year, m.month, 1))

async function loadCopyContext(db: Db, userId: number, input: CopyRange) {
  const rows = await db.teachingSession.findMany({
    where: { userId, sessionDate: { gte: monthStart(input.source), lt: nextMonthStart(input.source) } },
    select: {
      sessionDate: true,
      startTime: true,
      endTime: true,
      subjectId: true,
      title: true,
      status: true,
      makeupOfId: true,
      subject: { select: { name: true, color: true } },
      sessionStudents: { select: { studentId: true } },
    },
  })
  const subjects = new Map<number, { id: number; name: string; color: string }>()
  const sources: SourceSession[] = rows.map((r) => {
    subjects.set(r.subjectId, { id: r.subjectId, name: r.subject.name, color: r.subject.color })
    return {
      sessionDate: r.sessionDate,
      startTime: formatTime(r.startTime),
      endTime: formatTime(r.endTime),
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      title: r.title,
      status: r.status,
      makeupOfId: r.makeupOfId,
      studentIds: r.sessionStudents.map((s) => s.studentId),
    }
  })

  const allIds = [...new Set(sources.flatMap((s) => s.studentIds))]
  const students =
    allIds.length === 0
      ? []
      : await db.student.findMany({
          where: { userId, isActive: true, id: { in: allIds } },
          select: { id: true, tuitionFee: true, grade: true },
        })
  const patterns = deriveWeeklyPatterns(sources, input.source.year, input.source.month, new Set(students.map((s) => s.id)))

  const targets = targetMonths(input.from, input.months)
  const existingRows = await db.teachingSession.findMany({
    where: { userId, sessionDate: { gte: monthStart(targets[0]), lt: nextMonthStart(targets[targets.length - 1]) } },
    select: { sessionDate: true, startTime: true, endTime: true, status: true, title: true, subject: { select: { name: true } } },
  })
  const existing: ExistingSession[] = existingRows.map((r) => {
    const startTime = formatTime(r.startTime)
    const endTime = formatTime(r.endTime)
    return { sessionDate: r.sessionDate, startTime, endTime, status: r.status, label: conflictLabel(r.title, r.subject.name, startTime, endTime) }
  })

  return { patterns, targets, existing, subjects, students: new Map(students.map((s) => [s.id, s])), today: vnToday() }
}

export async function previewCopyMonth(db: PrismaClient, userId: number, input: SessionCopyMonthPreviewInput) {
  const ctx = await loadCopyContext(db, userId, input)
  const plan = planMonthCopy({ patterns: ctx.patterns, selectedKeys: input.patternKeys, targets: ctx.targets, existing: ctx.existing, today: ctx.today })
  const selected = new Set(plan.selectedKeys)
  return {
    patterns: ctx.patterns.map((p) => ({
      key: p.key,
      weekday: p.weekday,
      startTime: p.startTime,
      endTime: p.endTime,
      subject: ctx.subjects.get(p.subjectId)!,
      title: p.title,
      studentCount: p.studentIds.length,
      droppedInactive: p.droppedInactive,
      kind: p.kind,
      lastDate: ymd(p.lastDate),
      selected: selected.has(p.key),
      perMonth: plan.perPattern[p.key],
    })),
    months: plan.months,
    totals: plan.totals,
    conflicts: plan.conflicts.slice(0, MAX_PREVIEW_CONFLICTS),
  }
}

export async function copyMonth(db: PrismaClient, userId: number, input: SessionCopyMonthInput) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COPY_MONTH_LOCK_NS}::int, ${userId}::int)`
      // Đọc lại + tính lại sau khóa: request song song thứ 2 thấy ca của request 1 là "existing".
      const ctx = await loadCopyContext(tx, userId, input)
      const known = new Set(ctx.patterns.map((p) => p.key))
      const keys = input.patternKeys.filter((k) => known.has(k))
      if (keys.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Không có mẫu lịch hợp lệ để chép" })
      }
      const plan = planMonthCopy({ patterns: ctx.patterns, selectedKeys: keys, targets: ctx.targets, existing: ctx.existing, today: ctx.today })
      if (plan.candidates.length > COPY_MONTH_MAX_SESSIONS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quá nhiều ca, hãy chọn ít tháng hơn" })
      }
      const { existing, conflict, past } = plan.totals
      const result = { created: plan.candidates.length, months: plan.months, skipped: { existing, conflict, past } }
      if (plan.candidates.length === 0) return result

      const created = await tx.teachingSession.createManyAndReturn({
        data: plan.candidates.map((c) => ({
          userId,
          sessionDate: c.sessionDate,
          startTime: parseTimeToDate(c.startTime),
          endTime: parseTimeToDate(c.endTime),
          subjectId: c.subjectId,
          title: c.title,
          notes: null,
        })),
      })
      // Ngày + giờ bắt đầu là duy nhất trong lô vì planMonthCopy đã loại ứng viên chồng giờ nhau.
      const byDaySlot = new Map(plan.candidates.map((c) => [`${ymd(c.sessionDate)}|${c.startTime}`, c]))
      const links = created.flatMap((row) => {
        const cand = byDaySlot.get(`${ymd(row.sessionDate)}|${formatTime(row.startTime)}`)!
        return cand.studentIds.map((studentId) => {
          const st = ctx.students.get(studentId)!
          return { sessionId: row.id, studentId, fee: st.tuitionFee, grade: st.grade }
        })
      })
      if (links.length > 0) await tx.sessionStudent.createMany({ data: links })
      return result
    },
    { timeout: 15000 }
  )
}
```

- [ ] **Step 6: Nối router `src/server/trpc/routers/session.ts`**

Sửa import đầu file:

```ts
import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
```

Thêm `sessionCopyMonthPreviewSchema`, `sessionCopyMonthSchema` vào import từ `@/lib/schemas/session`, và import service:

```ts
import { copyMonth, previewCopyMonth } from "@/server/services/session-copy.service"
```

Thêm vào `sessionRouter` (sau `checkBulkConflicts`):

```ts
  copyMonthPreview: planProcedure("copyMonth")
    .input(sessionCopyMonthPreviewSchema)
    .query(({ ctx, input }) => previewCopyMonth(ctx.db, ctx.userId, input)),

  copyMonth: planProcedure("copyMonth")
    .input(sessionCopyMonthSchema)
    .mutation(({ ctx, input }) => copyMonth(ctx.db, ctx.userId, input)),
```

- [ ] **Step 7: Chạy test, xác nhận xanh**

Run: `pnpm test tests/integration/session-copy-month.test.ts`
Expected: PASS (9 test).

Run: `pnpm test tests/integration/plan-gating.test.ts`
Expected: PASS (các case mới `session.copyMonthPreview` / `session.copyMonth` ở Standard/Plus/Pro).

Run: `pnpm test tests/integration/session.test.ts` rồi `pnpm test tests/integration/makeup-session.test.ts`
Expected: PASS (không đổi hành vi cũ).

- [ ] **Step 8: Kiểm tra kiểu + lint**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi. Nếu `createManyAndReturn` trả `startTime` không phải `Date` → theo kiểu thật, ghi Ruling.

- [ ] **Step 9: Commit**

```bash
git add src/server/services/session-copy.service.ts src/server/trpc/routers/session.ts tests/integration/session-copy-month.test.ts tests/integration/plan-gating.test.ts
git commit -m "feat(m): service + procedure xem trước và chép lịch tháng (gói Plus)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: UI — nút "Chép lịch tháng" + `CopyMonthDialog`

**Đọc trước:** Global Constraints (nhất là mục "Thay đổi chưa commit của người khác"); spec mục 8 (8.1, 8.2), 9.5 (phần client), 11; `src/components/calendar/CalendarToolbar.tsx` (khối "Bottom/Right: Actions"); `src/components/calendar/MonthCalendar.tsx`; `src/hooks/useCalendar.ts` (`goToMonth`); `src/hooks/useFeatureGate.ts`; `src/components/plan/LockBadge.tsx`; `src/components/students/StudentList.tsx` (dòng ~70, ~222: mẫu `useFeatureGate` + `LockBadge`); `src/components/plan/PlanPurchaseDialog.tsx` (class `DialogContent` toàn màn hình mobile, nút X 44px); `src/components/reports/ExportExcelButton.tsx`; `src/hooks/useDebounce.ts`; `tests/unit/components/PlanPurchaseDialog.test.tsx` (cách mock `@/lib/trpc`).

**Files:**
- Create: `src/components/sessions/CopyMonthDialog.tsx`
- Modify: `src/components/calendar/CalendarToolbar.tsx` (prop `onCopyMonthClick`, khối hành động)
- Modify: `src/components/reports/ExportExcelButton.tsx` (prop `className?`)
- Modify: `src/components/calendar/MonthCalendar.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/components/CopyMonthDialog.test.tsx`

**Interfaces:**
- Consumes: `trpc.session.copyMonthPreview.useQuery(input, opts)`, `trpc.session.copyMonth.useMutation(opts)` (Task 3); `RouterOutputs["session"]["copyMonthPreview" | "copyMonth"]`; `COPY_MONTH_MAX_MONTHS`, `monthIndex`, `monthFromIndex`, `shiftMonth`, `targetMonths`, `MonthRef`, `PatternKind` (Task 1); `useFeatureGate("copyMonth")` (feature Task 2); `planRequiredOf` (`@/lib/plans`); `vnDateParts`, `cn` (`@/lib/utils`); `DAY_NAMES` (`@/lib/constants`).
- Produces:
  - `CopyMonthDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; initialYear: number; initialMonth: number; onViewMonth: (year: number, month: number) => void })`
  - `CalendarToolbar` prop mới bắt buộc `onCopyMonthClick: () => void`.
  - `ExportExcelButton` prop mới `className?: string`.
  - Test id (Task 5 dùng): `copy-month-button`, `copy-month-dialog`, `copy-source`, `copy-from`, `copy-months-1|2|3`, `copy-preview`, `copy-total`, `copy-empty`, `copy-pattern` (thuộc tính `data-selected`), `copy-pattern-kind`, `copy-confirm`, `copy-result`.

- [ ] **Step 1: Thêm key i18n**

`src/language/vi.json` (thêm liền nhau, sau `"bulk_schedule"`):

```json
  "copy_month": "Chép lịch tháng",
  "copy_month_title": "Chép lịch sang tháng sau",
  "copy_source": "Tháng nguồn",
  "copy_source_hint": "Lấy lịch gốc: ca bị huỷ vẫn tính, ca dạy bù không chép",
  "copy_target": "Tạo cho",
  "copy_from": "Từ tháng",
  "copy_months_count": "Số tháng",
  "copy_will_create": "Sẽ tạo {count} ca",
  "copy_skip_existing": "{count} ca đã có, bỏ qua",
  "copy_skip_conflict": "{count} ca trùng giờ, bỏ qua",
  "copy_skip_past": "{count} ngày đã qua, bỏ qua",
  "copy_kind_single": "Chỉ 1 buổi trong tháng",
  "copy_kind_stopped": "Không còn dạy sau {date}",
  "copy_kind_biweekly": "Có vẻ dạy cách tuần, chỉ chép được hằng tuần",
  "copy_kind_no_students": "Tất cả HS đã nghỉ",
  "copy_dropped_inactive": "bỏ {count} HS đã nghỉ",
  "copy_student_count": "{count} HS",
  "copy_conflict_count": "Trùng giờ {count} ca",
  "copy_month_count": "{month}: {count} ca",
  "copy_empty": "{month} chưa có ca nào để chép",
  "copy_confirm": "Tạo {count} ca",
  "copy_success": "Đã tạo {count} ca",
  "copy_view_month": "Xem {month}",
  "copy_close": "Đóng",
```

`src/language/en.json` (cùng vị trí, sau `"bulk_schedule"`):

```json
  "copy_month": "Copy month",
  "copy_month_title": "Copy schedule to next months",
  "copy_source": "Source month",
  "copy_source_hint": "Uses the original schedule: cancelled sessions count, make-up sessions are skipped",
  "copy_target": "Create for",
  "copy_from": "From",
  "copy_months_count": "Months",
  "copy_will_create": "{count} sessions will be created",
  "copy_skip_existing": "{count} already exist, skipped",
  "copy_skip_conflict": "{count} time conflicts, skipped",
  "copy_skip_past": "{count} past days, skipped",
  "copy_kind_single": "Only once this month",
  "copy_kind_stopped": "Not taught after {date}",
  "copy_kind_biweekly": "Looks biweekly, only weekly copy is supported",
  "copy_kind_no_students": "All students inactive",
  "copy_dropped_inactive": "{count} inactive students removed",
  "copy_student_count": "{count} students",
  "copy_conflict_count": "{count} time conflicts",
  "copy_month_count": "{month}: {count} sessions",
  "copy_empty": "{month} has no sessions to copy",
  "copy_confirm": "Create {count} sessions",
  "copy_success": "Created {count} sessions",
  "copy_view_month": "View {month}",
  "copy_close": "Close",
```

- [ ] **Step 2: Viết test đỏ `tests/unit/components/CopyMonthDialog.test.tsx`**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CopyMonthDialog } from "@/components/sessions/CopyMonthDialog"

type QueryOpts = { enabled?: boolean }
type MutOpts = { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }

const h = vi.hoisted(() => ({
  allowed: true,
  preview: null as unknown,
  inputs: [] as unknown[],
  opts: [] as QueryOpts[],
  mutate: vi.fn(),
  mutOpts: null as MutOpts | null,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({ allowed: h.allowed, locked: !h.allowed, requiredPlan: "plus", openUpgrade: vi.fn(), guard: (fn: () => void) => fn }),
}))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    session: {
      copyMonthPreview: {
        useQuery: (input: unknown, opts: QueryOpts) => {
          h.inputs.push(input)
          h.opts.push(opts)
          return { data: opts.enabled ? h.preview : undefined, error: null, isFetching: false, isPlaceholderData: false }
        },
      },
      copyMonth: {
        useMutation: (opts: MutOpts) => {
          h.mutOpts = opts
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

const MON = "0|17:00|19:00|1"
const TUE = "1|17:00|18:00|1"
const SAT = "5|10:00|11:00|1"
const subject = { id: 1, name: "Toán", color: "#0F766E" }
const count = (over: Record<string, number> = {}) => ({ year: 2030, month: 2, slots: 4, created: 4, existing: 0, conflict: 0, past: 0, ...over })
const PREVIEW = {
  patterns: [
    { key: MON, weekday: 0, startTime: "17:00", endTime: "19:00", subject, title: "Nhóm A", studentCount: 2, droppedInactive: 1, kind: "regular", lastDate: "2030-01-28", selected: true, perMonth: [count({ created: 3, conflict: 1 })] },
    { key: TUE, weekday: 1, startTime: "17:00", endTime: "18:00", subject, title: null, studentCount: 1, droppedInactive: 0, kind: "stopped", lastDate: "2030-01-08", selected: false, perMonth: [count({ created: 0 })] },
    { key: SAT, weekday: 5, startTime: "10:00", endTime: "11:00", subject, title: null, studentCount: 1, droppedInactive: 0, kind: "single", lastDate: "2030-01-26", selected: false, perMonth: [count({ created: 0 })] },
  ],
  months: [{ year: 2030, month: 2, created: 3 }],
  totals: { created: 3, existing: 2, conflict: 1, past: 0 },
  conflicts: [{ patternKey: MON, date: "2030-02-11", conflict: "Lớp Toán (17:30–18:30)" }],
}
const EMPTY = { patterns: [], months: [{ year: 2030, month: 2, created: 0 }], totals: { created: 0, existing: 0, conflict: 0, past: 0 }, conflicts: [] }

function renderDialog() {
  const props = { open: true, onOpenChange: vi.fn(), initialYear: 2030, initialMonth: 1, onViewMonth: vi.fn() }
  render(
    <LanguageProvider forcedLanguage="vi">
      <CopyMonthDialog {...props} />
    </LanguageProvider>
  )
  return props
}
const confirmBtn = () => screen.getByTestId("copy-confirm") as HTMLButtonElement
const boxes = () => screen.getAllByRole("checkbox")

beforeEach(() => {
  vi.clearAllMocks()
  h.allowed = true
  h.preview = PREVIEW
  h.inputs = []
  h.opts = []
  h.mutOpts = null
})
afterEach(() => {
  vi.useRealTimers()
})

describe("CopyMonthDialog", () => {
  it("mở: nguồn = tháng đang xem (kể cả ngoài khoảng chọn), từ = tháng sau, 1 tháng; lần đầu không gửi patternKeys", () => {
    renderDialog()
    expect(h.inputs.at(-1)).toEqual({ source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1 })
    expect(screen.getByTestId("copy-source").textContent).toContain("Tháng 1 / 2030")
    expect(screen.getByTestId("copy-from").textContent).toContain("Tháng 2 / 2030")
    expect(screen.getByTestId("copy-months-1").getAttribute("aria-checked")).toBe("true")
    expect(screen.getByTestId("copy-total").textContent).toBe("Sẽ tạo 3 ca")
    expect(screen.getByText("2 ca đã có, bỏ qua")).toBeTruthy()
    expect(screen.getByText("1 ca trùng giờ, bỏ qua")).toBeTruthy()
    expect(screen.queryByText(/ngày đã qua/)).toBeNull()
    expect(screen.getByText("Tháng 2 / 2030: 3 ca")).toBeTruthy()
    expect(confirmBtn().textContent).toContain("Tạo 3 ca")
    expect(confirmBtn().disabled).toBe(false)
  })

  it("mẫu regular tích sẵn, stopped/single không; pill loại, ngày dừng, HS bị bỏ, danh sách trùng giờ", () => {
    renderDialog()
    expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "false", "false"])
    expect(screen.getByText("Không còn dạy sau 08/01")).toBeTruthy()
    expect(screen.getByText("Chỉ 1 buổi trong tháng")).toBeTruthy()
    expect(screen.getAllByTestId("copy-pattern")[0].textContent).toContain("bỏ 1 HS đã nghỉ")
    fireEvent.click(screen.getByRole("button", { name: "Trùng giờ 1 ca" }))
    expect(screen.getByText("11/02: Lớp Toán (17:30–18:30)")).toBeTruthy()
  })

  it("tích thêm → nút Tạo khóa tới khi xem trước gọi lại (300ms) với patternKeys; bấm Tạo gửi đúng key", () => {
    vi.useFakeTimers()
    renderDialog()
    fireEvent.click(boxes()[2])
    expect(confirmBtn().disabled).toBe(true)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(h.inputs.at(-1)).toEqual({ source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1, patternKeys: [MON, SAT] })
    expect(confirmBtn().disabled).toBe(false)
    fireEvent.click(confirmBtn())
    expect(h.mutate).toHaveBeenCalledWith({ source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1, patternKeys: [MON, SAT] })
  })

  it("chọn 3 tháng → gửi months 3, tóm tắt khoảng tháng", () => {
    renderDialog()
    fireEvent.click(screen.getByTestId("copy-months-3"))
    expect(screen.getByTestId("copy-months-3").getAttribute("aria-checked")).toBe("true")
    expect(h.inputs.at(-1)).toMatchObject({ months: 3 })
    expect(screen.getByText("Tháng 2 / 2030 → Tháng 4 / 2030")).toBeTruthy()
  })

  it("tháng nguồn rỗng → trạng thái rỗng, nút Tạo khóa", () => {
    h.preview = EMPTY
    renderDialog()
    expect(screen.getByTestId("copy-empty").textContent).toBe("Tháng 1 / 2030 chưa có ca nào để chép")
    expect(confirmBtn().disabled).toBe(true)
  })

  it("chưa đủ gói → không gọi xem trước (enabled=false), nút Tạo khóa", () => {
    h.allowed = false
    renderDialog()
    expect(h.opts.every((o) => o.enabled === false)).toBe(true)
    expect(confirmBtn().disabled).toBe(true)
  })

  it("tạo xong → bước kết quả; Xem tháng chuyển lịch sang tháng đầu và đóng", () => {
    const props = renderDialog()
    act(() => {
      h.mutOpts?.onSuccess?.({ created: 3, months: [{ year: 2030, month: 2, created: 3 }], skipped: { existing: 2, conflict: 1, past: 0 } })
    })
    expect(screen.getByTestId("copy-result").textContent).toContain("Đã tạo 3 ca")
    expect(screen.getByTestId("copy-result").textContent).toContain("2 ca đã có, bỏ qua")
    fireEvent.click(screen.getByRole("button", { name: "Xem Tháng 2 / 2030" }))
    expect(props.onViewMonth).toHaveBeenCalledWith(2030, 2)
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("lỗi gói ở mutation → đóng dialog; lỗi khác → ở lại", () => {
    const props = renderDialog()
    act(() => {
      h.mutOpts?.onError?.({ message: "Quá nhiều ca, hãy chọn ít tháng hơn", data: { planRequired: null } })
    })
    expect(props.onOpenChange).not.toHaveBeenCalled()
    act(() => {
      h.mutOpts?.onError?.({ message: "Tính năng này cần gói Plus", data: { planRequired: "plus" } })
    })
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `pnpm test tests/unit/components/CopyMonthDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/sessions/CopyMonthDialog"`.

- [ ] **Step 4: Viết `src/components/sessions/CopyMonthDialog.tsx`**

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { keepPreviousData } from "@tanstack/react-query"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useDebounce } from "@/hooks/useDebounce"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { DAY_NAMES } from "@/lib/constants"
import {
  COPY_MONTH_MAX_MONTHS,
  monthFromIndex,
  monthIndex,
  shiftMonth,
  targetMonths,
  type MonthRef,
} from "@/lib/copy-month"
import { planRequiredOf } from "@/lib/plans"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { cn, vnDateParts } from "@/lib/utils"

type Preview = RouterOutputs["session"]["copyMonthPreview"]
type PatternPreview = Preview["patterns"][number]
type ConflictPreview = Preview["conflicts"][number]
type CopyResult = RouterOutputs["session"]["copyMonth"]
type Skipped = { existing: number; conflict: number; past: number }

const KIND_KEY = {
  single: "copy_kind_single",
  stopped: "copy_kind_stopped",
  biweekly: "copy_kind_biweekly",
  no_students: "copy_kind_no_students",
} as const
const MONTH_CHOICES = Array.from({ length: COPY_MONTH_MAX_MONTHS }, (_, i) => i + 1)

const refValue = (m: MonthRef) => `${m.year}-${m.month}`
const parseRef = (v: string): MonthRef => {
  const [year, month] = v.split("-").map(Number)
  return { year, month }
}
const dayMonth = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`

// 12 tháng trước tới 6 tháng sau tháng hiện tại (giờ VN); luôn có tháng đang xem dù nằm ngoài khoảng.
function sourceOptions(initial: MonthRef): MonthRef[] {
  const now = monthIndex(vnDateParts())
  const idx = new Set(Array.from({ length: 19 }, (_, i) => now - 12 + i))
  idx.add(monthIndex(initial))
  return [...idx].sort((a, b) => a - b).map(monthFromIndex)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialYear: number
  initialMonth: number
  onViewMonth: (year: number, month: number) => void
}

export function CopyMonthDialog({ open, onOpenChange, initialYear, initialMonth, onViewMonth }: Props) {
  const { t } = useTranslation()
  const gate = useFeatureGate("copyMonth")
  const initial = { year: initialYear, month: initialMonth }
  const [source, setSource] = useState<MonthRef>(initial)
  const [from, setFrom] = useState<MonthRef>(() => shiftMonth(initial, 1))
  const [months, setMonths] = useState(1)
  // null = chưa chạm ô chọn → server chọn mặc định theo loại mẫu.
  const [picked, setPicked] = useState<string[] | null>(null)
  const debouncedPicked = useDebounce(picked, 300)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [options] = useState(() => sourceOptions(initial))

  const monthLabel = (m: MonthRef) =>
    t("month_year_label").replace("{month}", String(m.month)).replace("{year}", String(m.year))

  const preview = trpc.session.copyMonthPreview.useQuery(
    { source, from, months, ...(debouncedPicked ? { patternKeys: debouncedPicked } : {}) },
    { enabled: open && gate.allowed && result === null, placeholderData: keepPreviousData }
  )
  const data = preview.data

  // TRPCProvider chỉ bắt lỗi gói của mutation; query hết hạn gói giữa chừng phải tự đóng dialog.
  useEffect(() => {
    if (preview.error && planRequiredOf(preview.error)) {
      toast.error(preview.error.message)
      onOpenChange(false)
    }
  }, [preview.error, onOpenChange])

  const copy = trpc.session.copyMonth.useMutation({
    onSuccess: (res) => {
      setResult(res)
      toast.success(t("copy_success").replace("{count}", String(res.created)))
    },
    onError: (err) => {
      toast.error(err.message)
      if (planRequiredOf(err)) onOpenChange(false)
    },
  })

  const selectedKeys = picked ?? data?.patterns.filter((p) => p.selected).map((p) => p.key) ?? []
  const toggle = (key: string) =>
    setPicked(selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key])
  // Số "Tạo N ca" phải là số server vừa tính cho đúng lựa chọn đang gửi.
  const stale = picked !== debouncedPicked || preview.isFetching || preview.isPlaceholderData
  const created = data?.totals.created ?? 0
  const canConfirm = !!data && !stale && created > 0 && !copy.isPending

  const changeSource = (v: string) => {
    const next = parseRef(v)
    setSource(next)
    setFrom(shiftMonth(next, 1))
    setPicked(null)
  }
  const fromOptions = Array.from({ length: 12 }, (_, i) => shiftMonth(source, i + 1))
  const targets = targetMonths(from, months)
  const groups = useMemo(() => {
    const byDay = new Map<number, PatternPreview[]>()
    for (const p of data?.patterns ?? []) byDay.set(p.weekday, [...(byDay.get(p.weekday) ?? []), p])
    return [...byDay.entries()]
  }, [data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="copy-month-dialog"
        aria-describedby={undefined}
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-y-auto rounded-none p-0 sm:rounded-none md:h-auto md:max-h-[90dvh] md:max-w-2xl md:rounded-xl [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
      >
        <DialogHeader className="p-4 pr-14 text-left md:p-6 md:pr-14">
          <DialogTitle>{t("copy_month_title")}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div data-testid="copy-result" className="flex-1 space-y-4 px-4 pb-6 md:px-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 aria-hidden className="size-8 shrink-0 text-primary" />
              <p className="text-lg font-semibold">{t("copy_success").replace("{count}", String(result.created))}</p>
            </div>
            <ul className="space-y-0.5 text-sm text-slate-600">
              {result.months.map((m) => (
                <li key={refValue(m)}>{t("copy_month_count").replace("{month}", monthLabel(m)).replace("{count}", String(m.created))}</li>
              ))}
            </ul>
            <SkipLines skipped={result.skipped} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11 md:h-10" onClick={() => onOpenChange(false)}>
                {t("copy_close")}
              </Button>
              <Button
                className="h-11 md:h-10"
                onClick={() => {
                  onViewMonth(from.year, from.month)
                  onOpenChange(false)
                }}
              >
                {t("copy_view_month").replace("{month}", monthLabel(from))}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 px-4 pb-4 md:px-6">
              <section className="space-y-1.5">
                <p className="text-sm font-medium text-slate-700">{t("copy_source")}</p>
                <Select value={refValue(source)} onValueChange={changeSource}>
                  <SelectTrigger data-testid="copy-source" aria-label={t("copy_source")} className="h-11 md:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((m) => (
                      <SelectItem key={refValue(m)} value={refValue(m)}>
                        {monthLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("copy_source_hint")}</p>
              </section>

              <section className="space-y-1.5">
                <p className="text-sm font-medium text-slate-700">{t("copy_target")}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select value={refValue(from)} onValueChange={(v) => setFrom(parseRef(v))}>
                    <SelectTrigger data-testid="copy-from" aria-label={t("copy_from")} className="h-11 sm:w-56 md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fromOptions.map((m) => (
                        <SelectItem key={refValue(m)} value={refValue(m)}>
                          {monthLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div role="radiogroup" aria-label={t("copy_months_count")} className="grid grid-cols-3 gap-2 sm:w-44">
                    {MONTH_CHOICES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={months === n}
                        data-testid={`copy-months-${n}`}
                        onClick={() => setMonths(n)}
                        className={cn(
                          "h-11 rounded-md border text-sm font-medium md:h-10",
                          months === n ? "border-primary bg-primary/[0.08] text-primary" : "border-slate-200 text-slate-600"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  {targets.length > 1
                    ? `${monthLabel(targets[0])} → ${monthLabel(targets[targets.length - 1])}`
                    : monthLabel(targets[0])}
                </p>
              </section>

              <section data-testid="copy-preview" className="space-y-3">
                {!data ? (
                  <Skeleton className="h-40 w-full" />
                ) : data.patterns.length === 0 ? (
                  <p data-testid="copy-empty" className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                    {t("copy_empty").replace("{month}", monthLabel(source))}
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <p data-testid="copy-total" className="text-lg font-semibold text-slate-900">
                        {t("copy_will_create").replace("{count}", String(data.totals.created))}
                      </p>
                      <SkipLines skipped={data.totals} />
                      <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                        {data.months.map((m) => (
                          <li key={refValue(m)}>
                            {t("copy_month_count").replace("{month}", monthLabel(m)).replace("{count}", String(m.created))}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {groups.map(([weekday, list]) => (
                      <div key={weekday} className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">{DAY_NAMES[weekday]}</p>
                        {list.map((p) => (
                          <PatternRow
                            key={p.key}
                            p={p}
                            checked={selectedKeys.includes(p.key)}
                            onToggle={() => toggle(p.key)}
                            conflicts={data.conflicts.filter((c) => c.patternKey === p.key)}
                          />
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 md:justify-end md:px-6">
              <Button variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                data-testid="copy-confirm"
                className="h-11 flex-1 gap-2 md:h-10 md:flex-none"
                disabled={!canConfirm}
                onClick={() => copy.mutate({ source, from, months, patternKeys: selectedKeys })}
              >
                {copy.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {t("copy_confirm").replace("{count}", String(created))}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SkipLines({ skipped }: { skipped: Skipped }) {
  const { t } = useTranslation()
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {skipped.existing > 0 && <li className="text-slate-600">{t("copy_skip_existing").replace("{count}", String(skipped.existing))}</li>}
      {skipped.conflict > 0 && <li className="text-amber-700">{t("copy_skip_conflict").replace("{count}", String(skipped.conflict))}</li>}
      {skipped.past > 0 && <li className="text-slate-600">{t("copy_skip_past").replace("{count}", String(skipped.past))}</li>}
    </ul>
  )
}

function PatternRow({
  p,
  checked,
  onToggle,
  conflicts,
}: {
  p: PatternPreview
  checked: boolean
  onToggle: () => void
  conflicts: ConflictPreview[]
}) {
  const { t } = useTranslation()
  const [showConflicts, setShowConflicts] = useState(false)
  const conflictCount = p.perMonth.reduce((s, m) => s + m.conflict, 0)
  const kindKey = p.kind === "regular" ? null : KIND_KEY[p.kind]
  const time = `${p.startTime}–${p.endTime}`

  return (
    <div data-testid="copy-pattern" data-selected={checked} className="rounded-lg border">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 p-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`${DAY_NAMES[p.weekday]} ${time}`} className="mt-0.5" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
            <span>
              {DAY_NAMES[p.weekday]} · {time}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: p.subject.color }} />
              {p.subject.name}
            </span>
            {p.title && <span className="min-w-0 truncate text-slate-500">{p.title}</span>}
          </span>
          <span className="block text-xs text-slate-500">
            {t("copy_student_count").replace("{count}", String(p.studentCount))}
            {p.droppedInactive > 0 && ` · ${t("copy_dropped_inactive").replace("{count}", String(p.droppedInactive))}`}
            {" · "}
            {p.perMonth.map((m) => `${m.month}/${m.year}: ${p.selected ? m.created : m.slots}`).join(" · ")}
          </span>
          {kindKey && (
            <span data-testid="copy-pattern-kind" className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              {t(kindKey).replace("{date}", dayMonth(p.lastDate))}
            </span>
          )}
        </span>
      </label>
      {conflictCount > 0 && (
        <div className="border-t bg-red-50 px-3 py-1 text-xs text-red-700">
          <button
            type="button"
            aria-expanded={showConflicts}
            onClick={() => setShowConflicts((v) => !v)}
            className="min-h-11 font-medium hover:underline md:min-h-8"
          >
            {t("copy_conflict_count").replace("{count}", String(conflictCount))}
          </button>
          {showConflicts && (
            <ul className="space-y-0.5 pb-2">
              {conflicts.slice(0, 20).map((c) => (
                <li key={c.date}>
                  {dayMonth(c.date)}: {c.conflict}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Chạy test dialog, xác nhận xanh**

Run: `pnpm test tests/unit/components/CopyMonthDialog.test.tsx`
Expected: PASS (8 test). Nếu Radix `SelectValue` không in nhãn trong jsdom khiến `copy-source`/`copy-from` không có chữ → giữ kiểm tra qua `h.inputs` và đổi 2 dòng kiểm chữ sang kiểm `h.inputs.at(-1)`, ghi Ruling (e2e Task 5 vẫn kiểm chữ trên trình duyệt thật).

- [ ] **Step 6: `ExportExcelButton` nhận `className`**

`src/components/reports/ExportExcelButton.tsx`:

```tsx
interface ExportExcelButtonProps {
  sessions: SessionDTO[]
  students?: StudentDTO[]
  className?: string
}

export function ExportExcelButton({ sessions, students = [], className }: ExportExcelButtonProps) {
```

và nút trigger:

```tsx
        <Button variant="outline" size="sm" disabled={isExporting} className={className}>
```

- [ ] **Step 7: Nút ở `CalendarToolbar.tsx`**

Kiểm `git status --short src/components/calendar/CalendarToolbar.tsx` trước: có thay đổi chưa commit không thuộc M → DỪNG, báo người dùng. Chỉ sửa import, props và khối "Bottom/Right: Actions"; phần tìm kiếm giữ nguyên như code thật.

Import (thêm `CalendarPlus` vào import lucide có sẵn, thêm 2 import):

```tsx
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Repeat, X } from "lucide-react"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
```

Props:

```tsx
interface CalendarToolbarProps {
  onCreateClick: () => void
  onBulkCreateClick: () => void
  onCopyMonthClick: () => void
  sessions: SessionDTO[]
  students?: StudentDTO[]
}
```

Destructure thêm `onCopyMonthClick`, và trong thân hàm (cạnh các hook khác):

```tsx
  const copyGate = useFeatureGate("copyMonth")
```

Thay toàn bộ khối `{/* Bottom/Right: Actions */}` (từ `<div className="flex flex-wrap items-center gap-2 pt-1 …">` tới thẻ đóng của nó) bằng:

```tsx
        {/* Dưới md lưới 2 cột: Lịch lặp | Chép lịch tháng, Xuất Excel | Tạo ca dạy; từ md giữ 1 hàng như cũ. */}
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-1 md:flex md:flex-wrap md:items-center md:justify-end md:border-t-0 md:pt-0">
          <ExportExcelButton
            sessions={sessions}
            students={students}
            className="order-3 h-11 w-full md:order-1 md:h-9 md:w-auto"
          />

          <Button
            variant="outline"
            onClick={onBulkCreateClick}
            className="order-1 h-11 w-full gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 md:order-2 md:h-10 md:w-auto"
          >
            <Repeat className="size-4" />
            <span>{t("bulk_schedule")}</span>
          </Button>

          {/* Khóa chứ không ẩn (spec I): Standard bấm mở UpgradeDialog thay vì dialog chép. */}
          <Button
            variant="outline"
            data-testid="copy-month-button"
            onClick={copyGate.guard(onCopyMonthClick)}
            className="order-2 h-11 w-full min-w-0 gap-2 border-slate-200 px-2 text-slate-600 hover:bg-slate-50 md:order-3 md:h-10 md:w-auto md:px-4"
          >
            <CalendarPlus className="size-4 shrink-0" />
            <span className="truncate">{t("copy_month")}</span>
            {copyGate.locked && <LockBadge plan={copyGate.requiredPlan} />}
          </Button>

          <Button onClick={onCreateClick} className="order-4 h-11 w-full gap-2 px-4 md:ml-2 md:h-10 md:w-auto md:px-6">
            <Plus className="size-4 md:size-5" />
            <span>{t("create_session")}</span>
          </Button>
        </div>
```

- [ ] **Step 8: Nối ở `MonthCalendar.tsx`**

Import:

```tsx
import { CopyMonthDialog } from "../sessions/CopyMonthDialog"
```

Đổi `const { year, month } = useCalendar()` thành:

```tsx
  const { year, month, goToMonth } = useCalendar()
```

State (cạnh `isBulkDialogOpen`):

```tsx
  const [isCopyOpen, setIsCopyOpen] = useState(false)
```

Prop cho toolbar:

```tsx
        onCopyMonthClick={() => setIsCopyOpen(true)}
```

Ngay sau `<BulkCreateDialog … />`:

```tsx
      {/* Mount theo điều kiện: mỗi lần mở chọn lại từ tháng đang xem, không giữ lựa chọn cũ. */}
      {isCopyOpen && (
        <CopyMonthDialog
          open
          onOpenChange={setIsCopyOpen}
          initialYear={year}
          initialMonth={month}
          onViewMonth={goToMonth}
        />
      )}
```

- [ ] **Step 9: Chạy lại test liên quan**

Run: `pnpm test tests/unit/components/CopyMonthDialog.test.tsx`
Expected: PASS.

Run: `pnpm test tests/unit/theme-legacy-colors.test.ts` rồi `pnpm test tests/unit/next15-contract.test.ts`
Expected: PASS.

Run: `pnpm test tests/unit/components/LanguageProvider.test.tsx`
Expected: PASS (vi/en cùng bộ key nếu test này có kiểm).

- [ ] **Step 10: Kiểm tra kiểu + lint**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi (thiếu key `en` hoặc thiếu prop `onCopyMonthClick` ở nơi khác dùng `CalendarToolbar` sẽ báo ở đây; `git grep -n "CalendarToolbar" -- src tests` để chắc chỉ `MonthCalendar` dùng).

- [ ] **Step 11: Commit**

```bash
git add src/components/sessions/CopyMonthDialog.tsx src/components/calendar/CalendarToolbar.tsx src/components/reports/ExportExcelButton.tsx src/components/calendar/MonthCalendar.tsx src/language/vi.json src/language/en.json tests/unit/components/CopyMonthDialog.test.tsx
git commit -m "feat(m): nút Chép lịch tháng + dialog xem trước và tạo ca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: E2E `tests/e2e/copy-month.spec.ts` (desktop, mobile 390px, khóa gói)

**Đọc trước:** Global Constraints (mục E2E); spec mục 2, 8, 12 (E2E); `tests/e2e/plan-locks.spec.ts` (ẩn `nextjs-portal`, `upgrade-dialog`, `setStd`, `EXPECTED_TEST_ENDPOINT`); `tests/e2e/calendar.spec.ts`, `tests/e2e/mobile.spec.ts` (`expectNoHorizontalScroll`); `playwright.config.ts`; `src/components/sessions/CopyMonthDialog.tsx`, `src/components/calendar/CalendarToolbar.tsx` (Task 4, test id).

**Files:**
- Test (Mới): `tests/e2e/copy-month.spec.ts`

**Interfaces:**
- Consumes: test id Task 4 (`copy-month-button`, `copy-month-dialog`, `copy-source`, `copy-from`, `copy-months-3`, `copy-pattern`, `copy-total`, `copy-confirm`, `copy-result`), `lock-badge`, `upgrade-dialog`, `plan-card-plus`; route `/calendar?year=&month=`; seed `teacher` (Pro), `teacher_std` (Standard).
- Produces: không.

Số ca tham chiếu (lịch đã kiểm): nguồn 1/2030 có 3 mẫu hằng tuần T2 17:00–18:30, T4 08:00–09:30, T5 19:00–20:30. Tháng 2/2030: 4 + 4 + 4 = 12; tháng 3/2030: 4 + 4 + 4 = 12; tháng 4/2030: T2 5 (1, 8, 15, 22, 29) + T4 4 + T5 4 = 13 → 3 tháng = 37.

- [ ] **Step 1: Viết `tests/e2e/copy-month.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const T = (s: string) => new Date(`1970-01-01T${s}:00.000Z`);
const RANGE = { gte: D('2030-01-01'), lt: D('2031-01-01') };
let teacherId = 0;
let subjectId = 0;
let stdId = 0;

async function mk(date: string, start: string, end: string, extra: { title: string; status?: string; makeupOfId?: number }) {
  return db.teachingSession.create({
    data: { userId: teacherId, subjectId, sessionDate: D(date), startTime: T(start), endTime: T(end), ...extra },
  });
}

async function login(page: Page, username: string) {
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
  await expect(page).toHaveURL(/.*dashboard/);
}

const boxOf = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!;
const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  teacherId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher' } })).id;
  stdId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  subjectId = (await db.subject.findFirstOrThrow({ where: { userId: teacherId } })).id;
  await db.teachingSession.deleteMany({ where: { userId: teacherId, sessionDate: RANGE } });

  for (const d of ['07', '14', '21', '28']) await mk(`2030-01-${d}`, '17:00', '18:30', { title: 'E2E Chép T2' });
  for (const d of ['02', '09', '23', '30']) await mk(`2030-01-${d}`, '08:00', '09:30', { title: 'E2E Chép T4' });
  const cancelled = await mk('2030-01-16', '08:00', '09:30', { title: 'E2E Chép T4', status: 'cancelled' });
  await mk('2030-01-18', '08:00', '09:30', { title: 'E2E Bù T6', makeupOfId: cancelled.id });
  for (const d of ['03', '10', '17', '24', '31']) await mk(`2030-01-${d}`, '19:00', '20:30', { title: 'E2E Chép T5' });
  await mk('2030-01-26', '10:00', '11:00', { title: 'E2E Lẻ T7' });
});

test.afterAll(async () => {
  await db.teachingSession.deleteMany({ where: { userId: teacherId, sessionDate: RANGE } });
  await db.user.update({ where: { id: stdId }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
  await db.$disconnect();
});

test('desktop: xem trước theo lịch gốc, tạo 3 tháng, chạy lại không trùng', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, 'teacher');
  await page.goto('/calendar?year=2030&month=1');

  await page.getByTestId('copy-month-button').click();
  const dlg = page.getByTestId('copy-month-dialog');
  await expect(dlg.getByTestId('copy-source')).toContainText('Tháng 1 / 2030');
  await expect(dlg.getByTestId('copy-from')).toContainText('Tháng 2 / 2030');

  const patterns = dlg.getByTestId('copy-pattern');
  await expect(patterns).toHaveCount(4);
  await expect(patterns.filter({ hasText: 'E2E Lẻ T7' })).toHaveAttribute('data-selected', 'false');
  await expect(patterns.filter({ hasText: 'E2E Chép T4' })).toHaveAttribute('data-selected', 'true');
  await expect(dlg.getByText('E2E Bù T6')).toHaveCount(0);
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 12 ca');

  await dlg.getByTestId('copy-months-3').click();
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 37 ca');
  await expect(dlg.getByTestId('copy-confirm')).toBeEnabled();
  await dlg.getByTestId('copy-confirm').click();
  await expect(dlg.getByTestId('copy-result')).toContainText('Đã tạo 37 ca');

  await dlg.getByRole('button', { name: 'Xem Tháng 2 / 2030' }).click();
  await expect(page).toHaveURL(/year=2030&month=2/);
  await expect(page.getByTestId('copy-month-dialog')).toHaveCount(0);
  // Thứ của ca gốc (kể cả thứ có ca đã huỷ) có đủ ca; thứ của ca bù không có.
  await expect(page.getByText('E2E Chép T2').filter({ visible: true })).toHaveCount(4);
  await expect(page.getByText('E2E Chép T4').filter({ visible: true })).toHaveCount(4);
  await expect(page.getByText('E2E Bù T6').filter({ visible: true })).toHaveCount(0);
  expect(await db.teachingSession.count({ where: { userId: teacherId, sessionDate: { gte: D('2030-02-01'), lt: D('2030-05-01') } } })).toBe(37);

  // Chạy lại từ tháng 1: mọi ca tháng 2 đã có → 0 ca, nút Tạo khóa.
  await page.goto('/calendar?year=2030&month=1');
  await page.getByTestId('copy-month-button').click();
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 0 ca');
  await expect(dlg.getByText('12 ca đã có, bỏ qua')).toBeVisible();
  await expect(dlg.getByTestId('copy-confirm')).toBeDisabled();
});

test('mobile 390px: nút toolbar ≥44px không chồng nhau, dialog toàn màn hình không tràn, tạo được', async ({ page }) => {
  await db.teachingSession.deleteMany({ where: { userId: teacherId, sessionDate: { gte: D('2030-02-01'), lt: D('2031-01-01') } } });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'teacher');
  await page.goto('/calendar?year=2030&month=1');

  const copyBtn = await boxOf(page, 'copy-month-button');
  const bulkBtn = (await page.getByRole('button', { name: 'Lịch lặp' }).boundingBox())!;
  const createBtn = (await page.getByRole('button', { name: 'Tạo ca dạy' }).filter({ visible: true }).first().boundingBox())!;
  for (const b of [copyBtn, bulkBtn, createBtn]) expect(b.height).toBeGreaterThanOrEqual(44);
  expect(intersects(copyBtn, bulkBtn)).toBe(false);
  expect(intersects(copyBtn, createBtn)).toBe(false);
  expect(intersects(bulkBtn, createBtn)).toBe(false);

  await page.getByTestId('copy-month-button').click();
  const dlg = page.getByTestId('copy-month-dialog');
  await expect(dlg.getByTestId('copy-total')).toHaveText('Sẽ tạo 12 ca');
  const dlgBox = (await dlg.boundingBox())!;
  expect(dlgBox.width).toBeGreaterThanOrEqual(389);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await dlg.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  const targets = dlg.locator('button:visible:not([role="checkbox"]), [data-testid="copy-pattern"] label');
  const n = await targets.count();
  for (let i = 0; i < n; i++) {
    const b = (await targets.nth(i).boundingBox())!;
    expect(b.height, `phần tử bấm thứ ${i} trong dialog`).toBeGreaterThanOrEqual(44);
  }

  await expect(dlg.getByTestId('copy-confirm')).toBeInViewport();
  await dlg.getByTestId('copy-confirm').click();
  await expect(dlg.getByTestId('copy-result')).toContainText('Đã tạo 12 ca');
});

test('Standard: nút có khóa, bấm mở popup nâng cấp, không gọi xem trước; /plan thẻ Plus có dòng mới', async ({ page }) => {
  await db.user.update({ where: { id: stdId }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
  const previewCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('session.copyMonthPreview')) previewCalls.push(r.url());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, 'teacher_std');
  await page.goto('/calendar');

  const btn = page.getByTestId('copy-month-button');
  await expect(btn.getByTestId('lock-badge')).toBeVisible();
  await btn.click();
  await expect(page.getByTestId('upgrade-dialog')).toContainText('Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.');
  await expect(page.getByTestId('copy-month-dialog')).toHaveCount(0);
  expect(previewCalls).toEqual([]);

  await page.goto('/plan');
  await expect(page.getByTestId('plan-card-plus')).toContainText('Chép lịch sang tháng sau (tối đa 3 tháng)');
});
```

Các `button:visible` trong dialog gồm nút X (size-11), 3 nút số tháng, nút trùng giờ (nếu có), Hủy, Tạo; ô chọn Radix (`button[role="checkbox"]`, 16px) bị loại khỏi selector; `SelectTrigger` là `button role="combobox"` nên đã nằm trong `button:visible` (vùng chạm là cả `label` hàng mẫu, `min-h-11`).

- [ ] **Step 2: Nạp seed rồi chạy e2e mới**

Run: `pnpm test tests/integration/plan-launch-migration.test.ts`
Expected: PASS.

Run: `pnpm exec playwright test tests/e2e/copy-month.spec.ts`
Expected: 3 passed. Nếu đỏ do UI (không phải do test) → sửa component Task 4 cho đúng spec, chạy lại test unit Task 4, ghi Ruling; nếu do selector test sai với DOM thật → sửa test theo DOM thật, giữ đúng ý kiểm tra.

- [ ] **Step 3: Chạy lại các e2e dễ vỡ vì toolbar / bảng tính năng**

Run lần lượt (không song song):
`pnpm exec playwright test tests/e2e/calendar.spec.ts`
`pnpm exec playwright test tests/e2e/mobile.spec.ts`
`pnpm exec playwright test tests/e2e/layout-desktop.spec.ts`
`pnpm exec playwright test tests/e2e/plan.spec.ts`
`pnpm exec playwright test tests/e2e/plan-locks.spec.ts`
Expected: tất cả passed. Đỏ do bố cục toolbar mới → sửa Task 4 component (không sửa test cũ trừ khi test cũ đếm đúng số dòng tính năng thẻ Plus; khi đó thêm dòng mới vào kỳ vọng, ghi Ruling).

- [ ] **Step 4: Kiểm tra kiểu + lint**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/copy-month.spec.ts
git commit -m "test(m): e2e chép lịch tháng desktop, mobile 390px, khóa gói Standard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

(Nếu Step 2–3 phải sửa file Task 4, `git add` thêm đúng các file đó.)

---

### Task 6: Kiểm tra toàn bộ (test, e2e, lint, build, kiểm tay)

**Đọc trước:** Global Constraints; spec mục 2 (tiêu chí hoàn thành), 12 ("Chung"), 13 (Review Focus của spec); mục "Review Focus" của plan này; `docs/coding-rule.md` §6.1.

**Files:** không tạo file mới. Chỉ sửa nếu kiểm tra phát hiện lỗi (sửa đúng file gây lỗi, kèm test tái hiện).

**Interfaces:** không.

- [ ] **Step 1: Xác nhận an toàn DB**

Đọc `docs/coding-rule.md` §6.1. So host `DATABASE_URL` trong `.env` (phải là `ep-polished-voice…`) với `.env.test` (phải là `localhost:5433`). Khác nhau mới tiếp tục. `docker ps` có container `student-test-pg` đang chạy.

- [ ] **Step 2: Toàn bộ unit + integration**

Run: `pnpm test`
Expected: toàn bộ PASS (~10–15 phút). Đỏ → `superpowers:systematic-debugging`, sửa, chạy lại file đỏ rồi chạy lại toàn bộ.

- [ ] **Step 3: Toàn bộ e2e**

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi `pnpm exec playwright test`
Expected: toàn bộ passed.

- [ ] **Step 4: Kiểu + lint**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi.

- [ ] **Step 5: Build với DB test**

Lấy `DATABASE_URL` và `DIRECT_URL` từ `.env.test` (chỉ đọc), chạy (Git Bash):

```bash
DATABASE_URL="<DATABASE_URL của .env.test>" DIRECT_URL="<DIRECT_URL của .env.test>" pnpm exec next build
```

Expected: build thành công. Không chạy `pnpm build`.

- [ ] **Step 6: Kiểm tay qua `pnpm exec playwright` hoặc trình duyệt trên server e2e**

Không chạy `pnpm dev` (DB prod). Kiểm tay bằng cách xem lại ảnh/trace của lượt e2e hoặc viết tạm 1 lệnh `pnpm exec playwright test tests/e2e/copy-month.spec.ts --headed` (không commit gì thêm), xác nhận bằng mắt:
- Desktop 1280: nút "Chép lịch tháng" nằm ngay sau "Lịch lặp", cùng chiều cao; dialog max-w-2xl, màu nhấn teal, pill amber, dòng trùng giờ đỏ nhạt; không có indigo/violet/purple.
- Mobile 390: lưới 2 cột (Lịch lặp | Chép lịch tháng; Xuất Excel | Tạo ca dạy), dialog toàn màn hình, chân dialog dính đáy.
- Chuyển tiếng Anh (menu ngôn ngữ): chuỗi dialog đủ, không lộ key.
Ghi kết quả vào báo cáo.

- [ ] **Step 7: Rà soát Review Focus**

Đối chiếu từng dòng "Review Focus" của plan và mục 13 của spec với code + test đã có (grep test name). Dòng nào chưa có test → thêm test vào file của task sở hữu, chạy lại file đó.

- [ ] **Step 8: Commit (chỉ khi Step 2–7 phải sửa gì)**

```bash
git add <đúng các file đã sửa>
git commit -m "fix(m): <mô tả ngắn>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

**KHÔNG merge, KHÔNG push.** Báo cáo: kết quả từng lệnh (số test pass), các Ruling của mọi task, `git log --oneline main..feat/m-chep-lich-thang`.

---

## Self-review (đã chạy khi viết plan)

- **Spec coverage:** mục 4 (thuật toán, trường hợp lẻ) → T1; 4.4 (HS còn học, fee/grade hiện tại) → T3; 5 (sinh ca, past, existing/conflict) → T1 + T3; 6 Q9–Q13, Q20 (trần, khóa, tính lại trong tx, không tin client, timeout) → T3; 8 (UI) → T4; 9.1 → T2; 9.2 → T1; 9.3–9.4 → T3; 9.5 (gói) → T2 (server/feature) + T3 (procedure) + T4 (client) + T5 (e2e); 10 (không migration) → Global Constraints; 11 → T2 + T4; 12 → T1–T5; tiêu chí hoàn thành mục 2 → T6.
- **Placeholder:** không có TBD/TODO; mọi bước code có code thật. Duy nhất Step 5 Task 6 có `<DATABASE_URL của .env.test>` là giá trị bí mật agent tự đọc, không ghi vào plan.
- **Kiểu nhất quán:** `WeeklyPattern`, `MonthCount` (có `slots`), `CopyConflict.date: string`, `planMonthCopy` trả `selectedKeys`/`months` dùng giống nhau ở T1 (định nghĩa), T3 (service), T4 (client qua `RouterOutputs`). Test id T4 khớp T5.
- **Review Focus:** 5 dòng, mỗi dòng có test ở task sở hữu (T1 unit, T4 unit, T5 e2e).
