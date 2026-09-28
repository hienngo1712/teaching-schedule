# P — Sửa backlog (nợ HS đã nghỉ, hydration #418, màu Excel, ca huỷ, lên lớp ↔ ca tương lai, giờ VN, đơn gói hết hạn, lỗi nhỏ J/L/M/N, màn Tài khoản admin, nút Xuất Excel chỉ icon, split button Thêm học sinh) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 9 mục backlog người dùng đã chốt (spec P mục 13): HS đã nghỉ còn nợ hiện ở "Cần chú ý" kèm nhãn "Đã nghỉ"; hết React #418 do giờ build lệch giữa các worker build; màu nhấn Excel về `#0F766E`; ca huỷ luôn đỏ; tự lên lớp cập nhật khối/gỡ HS lớp 12 trong ca chưa kết thúc (giờ VN); xoá HS/đổi khối so giờ VN; đơn gói chờ quá 7 ngày thành "Hết hạn"; các lỗi nhỏ J/L/M/N; màn `/admin/accounts` có cột Hành động (menu), cột gọn, phân trang; màn Lịch nút Xuất Excel chỉ icon; màn Học sinh gộp "Nhập Excel" vào split button "Thêm học sinh". Version `0.4.1`.

**Architecture:** Không migration. Hàm thuần mới `src/lib/session-time.ts` (`vnToday`, `hasSessionEnded`) dùng chung cho `student.service.ts` qua `findUnfinishedLinks`. Nợ HS nghỉ: `getMonthlyTuitionStatus` thêm tham số tùy chọn `onlyStudentIds`, `getDashboardAlerts` gọi lượt 2 cho HS nghỉ. Đơn hết hạn: "hết hạn lười" `expireStaleOrders` (1 câu `UPDATE` thô) gọi ở mọi đường đọc/ghi đơn, `approveOrder` chặn bằng điều kiện `createdAt`. Số đơn chờ admin: procedure mới `admin.pendingCount` dùng chung cho sidebar + tab bar. Giờ build: `next.config.mjs` chốt mốc qua `process.env.APP_BUILD_TIMESTAMP` để worker build thừa hưởng.

**Tech Stack:** Next.js 15.5 App Router, React 19, tRPC v11 (không transformer: `Date` về client là chuỗi), Prisma 5.22 + PostgreSQL, NextAuth `5.0.0-beta.32`, Tailwind 3.4 + shadcn/ui (Radix DropdownMenu/AlertDialog/Dialog), TanStack Query v5, Vitest 4 (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-p-sua-backlog-design.md` (P1–P11; Q1–Q25 tự chọn; U1–U7 người dùng chốt). Plan viết khi `main` = `86b37ff` (v0.4.0, N đã merge) → mọi mô tả "code hiện tại" là code `86b37ff`.

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`, lệnh `prisma`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **Không migration** trong P (không sửa `prisma/schema.prisma`). Cần đổi schema → DỪNG, báo người điều phối (phải backup Neon trước).
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm tra bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị `.env.test` (lệnh ở Task 9).
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000; `playwright.config.ts` tự khởi dev server với DB `.env.test`, `ADMIN_USERNAMES=admin_test`, env ngân hàng test, `reuseExistingServer: false`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo người dùng. Trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trong `beforeAll` (mẫu `tests/e2e/plan.spec.ts`). Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. Đo kích thước trong dialog/alertdialog: chờ `el.getAnimations()` xong rồi mới `boundingBox()`.
- Tài khoản seed DB test (mật khẩu `teacher123`): `teacher`, `teacher2` (Pro tới 2099), `teacher_std` (Standard), `admin_test` (admin trong test/e2e). **Không nhập credential vào trình duyệt trên production; không ghi dữ liệu production.** Thử trên prod chỉ bằng `qa_test` (id 4), người dùng tự đăng nhập.
- **Giờ VN = UTC+7.** `sessionDate` là `Date.UTC(y, m-1, d)`; `endTime`/`startTime` là giờ tường VN trong thành phần UTC. Không dùng `getDate()/getHours()` giờ máy ở server.
- Integration giả thời gian: chỉ giả `Date` — `vi.useFakeTimers({ toFake: ["Date"] })` (tiền lệ `tests/integration/parent-link.test.ts`), luôn `vi.useRealTimers()` ở `afterEach`.
- **Từ tháng 7 `auth.me` tự lên lớp và ghi `class_upgrade_logs`** (FK tới `users`): test tạo/xoá user phải xoá log trước khi xoá user (mẫu `tests/e2e/admin-reset-password.spec.ts` `cleanup`).
- i18n: `src/language/vi.json` và `en.json` cùng bộ key (`tsc` bắt thiếu key ở `en`). Chuỗi mới không dùng gạch dài (—, –). Thay biến bằng `.replace("{x}", ...)`.
- Màu (A3): nhấn `primary` (#0F766E), trung tính slate, cảnh báo amber, lỗi đỏ như code sẵn có. **Không** indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass). Nút/vùng chạm ≥44px trên mobile: `h-11 md:h-10`/`size-11 md:size-9`, item menu `min-h-11 md:min-h-0`.
- `tests/unit/next15-contract.test.ts` đỏ nếu `page.tsx`/`layout.tsx` có định danh `params`/`searchParams` (kể cả trong comment). Không thêm định danh đó vào page/layout.
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy; không mô tả lại code.
- Giữ kiểu xuống dòng của từng file (repo đang LF, `core.autocrlf=true`); không đổi hàng loạt xuống dòng.
- Làm trên nhánh `fix/p-sua-backlog` (Task 1 tạo từ `main` mới nhất). **Không commit lên `main`. Agent thực hiện task KHÔNG merge, KHÔNG push.** Không đụng file untracked của người khác.
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit (chỉ `git add` đúng file của task). Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- **Đối chiếu code thật:** trước khi sửa, đọc file thật. Code lệch mô tả trong plan (dòng, tên biến) → theo code thật, giữ đúng hành vi spec, ghi "Ruling: …" vào báo cáo task. Test cũ mâu thuẫn trực tiếp với spec P (vd khẳng định "ca tương lai giữ khối cũ sau lên lớp") → sửa test theo spec, ghi Ruling; test cũ đỏ không liên quan → DỪNG, báo.

## Điều chỉnh so với spec

1. **Spec P9 ghi test tab bar ở file mới** → đặt vào `tests/unit/components/AdminNav.test.tsx` sẵn có (đã test `AdminSidebar` + `AdminTabBar` cùng mock tRPC).
2. **P2 kiểm chứng thật chỉ làm được sau `next build`** (dev nạp config 1 lần, không tái hiện) → Task 4 chỉ có unit mô phỏng; Task 9 grep `.next` sau build phải thấy đúng 1 giá trị giờ build.
3. **L2 test song song có thể xanh ngay trước khi sửa** (2 request có thể chạy nối tiếp) → giữ làm test hồi quy, RED của L2 không bắt buộc; ghi vào báo cáo Task 6.
4. **Thứ tự file e2e admin:** Task 7 sửa `admin-trial.spec.ts`, `admin-reset-password.spec.ts` (bấm nút rời → mở menu). Task 5 không đụng các file này.
5. Plan có **9 task** (Task 1 nhánh + docs; Task 8 là P10–P11 người dùng bổ sung sau, tách task riêng theo yêu cầu; Task 9 kiểm chứng + version). Yêu cầu ban đầu 5–8 task, thêm 1 vì P10–P11 là yêu cầu mới.

## Review Focus

1. **HS nghỉ còn nợ nhưng không có ca tháng này** (trường hợp chính người dùng gặp): phải hiện, đúng số tiền như màn Học phí lọc `studentId`, không trùng dòng khi HS nghỉ vẫn có ca tháng này. Pin: integration Task 3 `tests/integration/dashboard-alerts.test.ts` (2 ca "HS đã nghỉ…").
2. **Ca sáng/chiều nay đã dạy xong khi lên lớp/xoá HS/đổi khối lúc tối, và ca tối qua lúc sau nửa đêm VN:** không bị đổi/gỡ. Pin: unit Task 2 `tests/unit/lib/session-time.test.ts` + integration Task 2 (18:00 VN và 01:00 VN hôm sau) ở `student-delete-schedule-sync.test.ts`, `student-upgrade.test.ts`.
3. **Admin bấm Xác nhận đơn quá 7 ngày khi chưa ai mở trang nào để expire:** phải bị chặn, user không lên gói. Pin: integration Task 5 `tests/integration/admin.test.ts` ("duyệt đơn quá 7 ngày … BAD_REQUEST").
4. **Mở dialog từ menu Hành động rồi đóng:** trang không bị kẹt `pointer-events: none`, bấm được menu dòng khác. Pin: e2e Task 7 `tests/e2e/admin-accounts.spec.ts` (kiểm `document.body.style.pointerEvents` + mở menu dòng admin sau khi Hủy).
5. **Popup mua gói khi mạng chập chờn sau khi tạo đơn:** không Skeleton mãi, vẫn thấy mã chuyển khoản. Pin: unit Task 6 `tests/unit/components/PlanPurchaseDialog.test.tsx` ("refetch lỗi → hiện lỗi + mã SM + Thử lại").

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `docs/superpowers/specs/2026-09-27-p-sua-backlog-design.md`, `docs/superpowers/plans/2026-09-27-p-sua-backlog.md` | Mới (commit) | Spec + plan | 1 |
| `src/lib/session-time.ts` | Mới | `vnToday`, `hasSessionEnded` | 2 |
| `src/server/services/student.service.ts` | Sửa | `findUnfinishedLinks`; `updateStudent`, `softDeleteStudent`, `upgradeAllClasses` | 2 |
| `tests/unit/lib/session-time.test.ts` | Mới | Luật giờ VN | 2 |
| `tests/integration/student-upgrade.test.ts`, `student-delete-schedule-sync.test.ts` | Sửa | Giờ VN, lên lớp ↔ ca tương lai | 2 |
| `src/server/services/tuition.service.ts` | Sửa | Tham số `onlyStudentIds` | 3 |
| `src/server/services/report.service.ts` | Sửa | Nợ gồm HS nghỉ, `isActive` | 3 |
| `src/components/dashboard/DashboardAlerts.tsx` | Sửa | Nhãn "Đã nghỉ" | 3 |
| `tests/integration/dashboard-alerts.test.ts`, `tests/unit/components/DashboardAlerts.test.tsx`, `tests/e2e/dashboard-alerts.spec.ts` | Sửa | P1 | 3 |
| `next.config.mjs` | Sửa | Chốt giờ build | 4 |
| `tests/unit/next-config-build-time.test.ts` | Mới | P2 | 4 |
| `src/lib/constants.ts`, `src/hooks/useExcelExport.ts`, `src/lib/student-import-excel.ts`, `src/server/services/backup.service.ts` | Sửa | Màu Excel | 4 |
| `tests/unit/theme-legacy-colors.test.ts` | Sửa | Bắt hex | 4 |
| `src/components/calendar/SessionCard.tsx`, `tests/unit/components/SessionCard.test.tsx` | Sửa | Ca huỷ đỏ | 4 |
| `src/lib/plans.ts` | Sửa | `ORDER_TTL_DAYS`, `orderExpiresAt` | 5 |
| `src/server/services/plan.service.ts`, `plan-admin.service.ts`, `src/server/trpc/routers/admin.ts` | Sửa | Hết hạn lười, chặn duyệt, `pendingCount` | 5 |
| `src/app/(app)/plan/page.tsx`, `src/components/plan/PendingOrderCard.tsx`, `src/components/admin/AdminOrderHistory.tsx`, `AdminPendingOrders.tsx`, `AdminSidebar.tsx`, `AdminTabBar.tsx` | Sửa | Hiển thị hết hạn, số đơn chờ | 5 |
| `tests/unit/lib/plans.test.ts`, `tests/integration/plan-orders.test.ts`, `tests/integration/admin.test.ts`, `tests/unit/components/AdminNav.test.tsx`, `tests/e2e/plan.spec.ts` | Sửa | P7, J4, J5 | 5 |
| `src/components/plan/PlanPurchaseDialog.tsx`, `CurrentPlanBadge.tsx`, `src/lib/radio-group-keys.ts` (Mới) | Sửa/Mới | J1–J3 | 6 |
| `src/server/services/trial.service.ts`, `plan-price.service.ts` | Sửa | L1–L3 | 6 |
| `src/lib/copy-month.ts`, `src/server/services/session-copy.service.ts` | Sửa | M1 | 6 |
| `src/app/change-password/page.tsx`, `PasswordAlreadyChanged.tsx` (Mới), `src/components/admin/ResetPasswordDialog.tsx` | Sửa/Mới | N1, N2 | 6 |
| `tests/unit/lib/radio-group-keys.test.tsx`, `tests/unit/components/PasswordAlreadyChanged.test.tsx` (Mới); `PlanPurchaseDialog.test.tsx`, `CurrentPlanBadge.test.tsx`, `ResetPasswordDialog.test.tsx`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/lib/copy-month.test.ts`, `tests/integration/trial-days.test.ts`, `plan-prices.test.ts` (Sửa) | | Test Task 6 | 6 |
| `src/components/admin/AdminAccounts.tsx` | Sửa | Menu Hành động, cột, phân trang | 7 |
| `tests/unit/components/AdminAccounts.test.tsx`, `tests/e2e/admin-accounts.spec.ts` (Mới); `tests/e2e/admin-trial.spec.ts`, `admin-reset-password.spec.ts` (Sửa) | | P9 | 7 |
| `src/components/reports/ExportExcelButton.tsx`, `src/components/calendar/CalendarToolbar.tsx` | Sửa | `iconOnly`, bố cục hàng nút | 8 |
| `src/components/students/AddStudentSplitButton.tsx` (Mới), `StudentList.tsx`, `ImportStudentsDialog.tsx` | Mới/Sửa | Split button, export dialog, xoá `ImportStudentsButton` | 8 |
| `tests/unit/components/ExportExcelButton.test.tsx`, `AddStudentSplitButton.test.tsx` (Mới); `ImportStudentsDialog.test.tsx`, `tests/e2e/students-import.spec.ts`, `plan-locks.spec.ts`, `copy-month.spec.ts`, `layout-desktop.spec.ts`, `students.spec.ts` (Sửa) | | P10, P11 | 8 |
| `src/language/vi.json`, `en.json` | Sửa | Key theo từng task | 3, 5, 6, 7, 8 |
| `package.json` | Sửa | `version` → `0.4.1` | 9 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → … → 9. Các task gần như độc lập về code; thứ tự để tránh đụng cùng file: T5 sửa `AdminSidebar`/`AdminTabBar`/`AdminPendingOrders`, T6 sửa `ResetPasswordDialog`, T7 sửa `AdminAccounts` + e2e admin, T8 sửa `CalendarToolbar`/`StudentList` + e2e màn Học sinh/Lịch; i18n mỗi task chỉ thêm key của mình.

---
### Task 1: Tạo nhánh `fix/p-sua-backlog`, commit spec + plan

**Đọc trước:** Global Constraints; spec mục 12–13.

**Files:**
- Commit: `docs/superpowers/specs/2026-09-27-p-sua-backlog-design.md`, `docs/superpowers/plans/2026-09-27-p-sua-backlog.md` (chỉ 2 file này)

**Interfaces:**
- Consumes: không.
- Produces: nhánh `fix/p-sua-backlog` có 1 commit docs trên `main` mới nhất.

- [ ] **Step 1: Kiểm `main` và tạo nhánh**

Run (Bash):
```bash
git checkout main
git pull --ff-only
git log --oneline -3 main
grep '"version"' package.json
git status --short
```
Expected: đỉnh `main` là `86b37ff feat: merge feat/n-ghi-nho-dang-nhap → main …` hoặc mới hơn (có commit mới hơn → vẫn làm, ghi hash vào báo cáo); `"version": "0.4.0"`. `git status --short` có 2 file untracked của P (spec, plan); file khác của người dùng thì kệ, KHÔNG add. `version` khác `0.4.0` → ghi vào báo cáo (Task 9 vẫn nâng lên patch kế tiếp của bản đó, báo người điều phối).

```bash
git checkout -b fix/p-sua-backlog
git add docs/superpowers/specs/2026-09-27-p-sua-backlog-design.md docs/superpowers/plans/2026-09-27-p-sua-backlog.md
git commit -m "docs(p): spec + plan sửa backlog (nợ HS nghỉ, #418, màu Excel, ca huỷ, lên lớp, giờ VN, đơn hết hạn, lỗi nhỏ J/L/M/N, màn Tài khoản admin)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
git show --stat HEAD
```
Expected: commit chỉ có 2 file. Nhánh đã có (agent trước làm dở) → `git checkout fix/p-sua-backlog`; `git log main..HEAD` đã có commit docs thì bỏ qua bước commit.

- [ ] **Step 2: Xác nhận DB test (để task sau khỏi bất ngờ)**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
docker ps --filter name=student-test-pg --format '{{.Names}} {{.Status}}'
```
Expected: `env=ep-polished-voice…` và `test=localhost`; container `student-test-pg Up …`. Giống nhau hoặc container không chạy → ghi vào báo cáo, DỪNG.

- [ ] **Step 3: Báo cáo** (hash commit, version, trạng thái DB test).

---
### Task 2: Giờ VN cho "ca đã kết thúc" + tự lên lớp cập nhật ca chưa kết thúc (P6, P5)

**Đọc trước:** Global Constraints; spec mục 3.5, 3.6, Q8–Q10; `src/server/services/student.service.ts` (toàn bộ `updateStudent`, `softDeleteStudent`, `upgradeAllClasses`); `src/lib/utils.ts` (`vnDateParts`, `parseTimeToDate`); `src/server/trpc/routers/auth.ts` (`auth.me` tự lên lớp từ tháng 7); `tests/integration/student-upgrade.test.ts`, `tests/integration/student-delete-schedule-sync.test.ts` (toàn bộ); `tests/integration/parent-link.test.ts` quanh dòng 248 (mẫu giả `Date`).

**Files:**
- Create: `src/lib/session-time.ts`
- Modify: `src/server/services/student.service.ts`
- Test (Mới): `tests/unit/lib/session-time.test.ts`
- Test (Sửa): `tests/integration/student-delete-schedule-sync.test.ts`, `tests/integration/student-upgrade.test.ts`

**Interfaces:**
- Consumes: `vnDateParts(now?: Date): { year; month; day }` (`src/lib/utils.ts`).
- Produces:
  - `src/lib/session-time.ts`: `vnToday(now?: Date): Date`; `hasSessionEnded(session: { sessionDate: Date; endTime: Date }, now?: Date): boolean`.
  - `student.service.ts` (nội bộ, không export): `findUnfinishedLinks(tx: Prisma.TransactionClient, userId: number, studentIds: number[], now: Date): Promise<{ id: number; studentId: number; session: { sessionDate: Date; endTime: Date } }[]>`.
  - `upgradeAllClasses` giữ nguyên chữ ký và kiểu trả về `{ upgradedCount; deactivatedCount; year }`.

- [ ] **Step 1: Xác nhận DB test + chạy nền 2 file integration**

Run (Bash): `h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"`
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

Run: `pnpm test tests/integration/student-upgrade.test.ts` rồi `pnpm test tests/integration/student-delete-schedule-sync.test.ts`
Expected: ghi lại số pass/fail làm mốc (ca nào đã đỏ sẵn trước khi sửa → ghi vào báo cáo, không tính là lỗi của task).

- [ ] **Step 2: Unit test luật giờ VN (RED)**

Tạo `tests/unit/lib/session-time.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { hasSessionEnded, vnToday } from "@/lib/session-time"
import { parseTimeToDate } from "@/lib/utils"

const ses = (date: string, end: string) => ({ sessionDate: new Date(`${date}T00:00:00Z`), endTime: parseTimeToDate(end) })

describe("vnToday (spec P6)", () => {
  it("23:30Z ngày 9 = 06:30 VN ngày 10 → ngày 10", () => {
    expect(vnToday(new Date("2099-03-09T23:30:00Z")).toISOString()).toBe("2099-03-10T00:00:00.000Z")
  })
  it("16:59Z = 23:59 VN cùng ngày", () => {
    expect(vnToday(new Date("2099-03-10T16:59:00Z")).toISOString()).toBe("2099-03-10T00:00:00.000Z")
  })
})

describe("hasSessionEnded — so giờ tường VN (spec P6)", () => {
  const at18hVn = new Date("2099-03-10T11:00:00Z")
  it("18:00 VN: ca kết thúc 17:00 cùng ngày đã xong, ca kết thúc 20:00 chưa", () => {
    expect(hasSessionEnded(ses("2099-03-10", "17:00"), at18hVn)).toBe(true)
    expect(hasSessionEnded(ses("2099-03-10", "20:00"), at18hVn)).toBe(false)
  })
  it("đúng phút kết thúc → đã kết thúc", () => {
    expect(hasSessionEnded(ses("2099-03-10", "18:00"), at18hVn)).toBe(true)
  })
  it("01:00 VN hôm sau: ca tối qua kết thúc 21:00 đã xong, ca sáng nay kết thúc 09:00 chưa", () => {
    const at1hVn = new Date("2099-03-10T18:00:00Z")
    expect(hasSessionEnded(ses("2099-03-10", "21:00"), at1hVn)).toBe(true)
    expect(hasSessionEnded(ses("2099-03-11", "09:00"), at1hVn)).toBe(false)
  })
})
```

Run: `pnpm test tests/unit/lib/session-time.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/session-time"`.

- [ ] **Step 3: Tạo `src/lib/session-time.ts`**

```ts
import { vnDateParts } from "@/lib/utils"

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

// Ngày VN hôm nay ở cùng dạng sessionDate (@db.Date lưu nửa đêm UTC).
export function vnToday(now: Date = new Date()): Date {
  const { year, month, day } = vnDateParts(now)
  return new Date(Date.UTC(year, month - 1, day))
}

// endTime lưu giờ tường VN trong thành phần UTC → so với giờ tường VN của now, không phải now UTC (lệch 7h).
export function hasSessionEnded(session: { sessionDate: Date; endTime: Date }, now: Date = new Date()): boolean {
  const d = session.sessionDate
  const t = session.endTime
  const endWallMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds())
  return endWallMs <= now.getTime() + VN_OFFSET_MS
}
```

Run: `pnpm test tests/unit/lib/session-time.test.ts`
Expected: PASS 5 test.

- [ ] **Step 4: Integration giờ VN cho xoá HS / đổi khối (RED)**

Trong `tests/integration/student-delete-schedule-sync.test.ts`: import thêm `vi, afterEach` từ `vitest`. Thay ca cũ `"✓ xóa HS → giữ buổi hôm nay đã kết thúc, gỡ buổi hôm nay chưa kết thúc"` (dựa "hôm nay UTC" + giờ 00:01/23:59, sẽ chập chờn 00:00–07:00 VN sau khi sửa) bằng khối sau (đặt trong cùng `describe`, dùng `subjectId` của file):
```ts
  describe("giờ VN (spec P6)", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("18:00 VN: xoá HS giữ ca 16:00–17:00 vừa dạy, gỡ ca 19:00–20:00 cùng ngày", async () => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2099-03-10T11:00:00Z"))
      const caller = await getAuthedCaller()
      const a = await caller.student.create({ fullName: "HS Giờ VN", grade: 5 })
      const ended = await caller.session.create({ sessionDate: "2099-03-10", startTime: "16:00", endTime: "17:00", subjectId, studentIds: [a.id] })
      const upcoming = await caller.session.create({ sessionDate: "2099-03-10", startTime: "19:00", endTime: "20:00", subjectId, studentIds: [a.id] })

      await caller.student.delete({ id: a.id })

      expect((await caller.session.getDetail({ id: ended.id })).studentCount).toBe(1)
      expect((await caller.session.getDetail({ id: upcoming.id })).studentCount).toBe(0)
    })

    it("01:00 VN hôm sau: xoá HS giữ ca tối qua 20:00–21:00, gỡ ca sáng nay 08:00", async () => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2099-03-10T18:00:00Z"))
      const caller = await getAuthedCaller()
      const a = await caller.student.create({ fullName: "HS Nửa Đêm", grade: 5 })
      const lastNight = await caller.session.create({ sessionDate: "2099-03-10", startTime: "20:00", endTime: "21:00", subjectId, studentIds: [a.id] })
      const morning = await caller.session.create({ sessionDate: "2099-03-11", startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id] })

      await caller.student.delete({ id: a.id })

      expect((await caller.session.getDetail({ id: lastNight.id })).studentCount).toBe(1)
      expect((await caller.session.getDetail({ id: morning.id })).studentCount).toBe(0)
    })
  })
```

Trong `tests/integration/student-upgrade.test.ts` (describe `"SessionStudent.grade snapshot"`): import thêm `afterEach`. Thay ca cũ `"updateStudent đổi grade → KHÔNG ghi đè grade buổi hôm nay ĐÃ kết thúc"` (dựa `todayYmd()` UTC + 00:00–00:01) bằng:
```ts
  it("updateStudent đổi grade lúc 18:00 VN → giữ khối ca 16:00–17:00 vừa dạy, đổi khối ca 19:00–20:00 (spec P6)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2099-03-10T11:00:00Z"))
    try {
      const caller = await getAuthedCaller("teacher")
      const subject = (await caller.subject.list({}))[0]
      const student = await caller.student.create({ fullName: "HS Sync VN", grade: 3, tuitionFee: 0, isActive: true })
      const ended = await caller.session.create({ sessionDate: "2099-03-10", startTime: "16:00", endTime: "17:00", subjectId: subject.id, studentIds: [student.id] })
      const upcoming = await caller.session.create({ sessionDate: "2099-03-10", startTime: "19:00", endTime: "20:00", subjectId: subject.id, studentIds: [student.id] })

      await caller.student.update({ id: student.id, data: { grade: 7 } })

      const gradeOf = async (sessionId: number) =>
        (await db.sessionStudent.findFirstOrThrow({ where: { sessionId, studentId: student.id } })).grade
      expect(await gradeOf(ended.id)).toBe(3)
      expect(await gradeOf(upcoming.id)).toBe(7)
    } finally {
      vi.useRealTimers()
    }
  }, 30_000)
```
Nếu `todayYmd` không còn nơi nào dùng → xoá hàm đó.

Run: `pnpm test tests/integration/student-delete-schedule-sync.test.ts`
Expected: FAIL 2 ca mới (code cũ coi ca đã dạy là chưa kết thúc → `studentCount` 0 thay vì 1).
Run: `pnpm test tests/integration/student-upgrade.test.ts`
Expected: FAIL ca "updateStudent đổi grade lúc 18:00 VN…" (`gradeOf(ended)` = 7).

- [ ] **Step 5: Integration lên lớp ↔ ca chưa kết thúc (RED)**

Thêm vào cuối `tests/integration/student-upgrade.test.ts`:
```ts
describe("upgradeAllClasses ↔ ca chưa kết thúc theo giờ VN (spec P5)", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    await resetUserData("teacher2")
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // 18:00 VN 15/07/2099. HS lớp 5 + HS lớp 12 học chung; HS lớp 8 đã nghỉ từ trước.
  async function seed() {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2099-07-15T11:00:00Z"))
    const caller = await getAuthedCaller("teacher")
    const subjectId = (await caller.subject.list({}))[0].id
    const g5 = await caller.student.create({ fullName: "HS Lop 5", grade: 5, tuitionFee: 0, isActive: true })
    const g12 = await caller.student.create({ fullName: "HS Lop 12", grade: 12, tuitionFee: 0, isActive: true })
    const g8 = await caller.student.create({ fullName: "HS Lop 8 Nghi", grade: 8, tuitionFee: 0, isActive: true })
    const mk = (sessionDate: string, startTime: string, endTime: string, studentIds: number[]) =>
      caller.session.create({ sessionDate, startTime, endTime, subjectId, studentIds })
    const s = {
      past: await mk("2099-07-14", "08:00", "09:00", [g5.id, g12.id]),
      endedToday: await mk("2099-07-15", "16:00", "17:00", [g5.id, g12.id]),
      laterToday: await mk("2099-07-15", "19:00", "20:00", [g5.id, g12.id]),
      future: await mk("2099-07-20", "08:00", "09:00", [g5.id, g12.id, g8.id]),
      onlyG12: await mk("2099-07-21", "08:00", "09:00", [g12.id]),
    }
    // Nghỉ trước khi lên lớp nhưng vẫn còn trong ca 20/07 (dữ liệu cũ): lên lớp không được đụng.
    await db.student.update({ where: { id: g8.id }, data: { isActive: false } })
    return { caller, g5, g12, g8, s }
  }

  async function links(sessionId: number) {
    return db.sessionStudent.findMany({ where: { sessionId }, select: { studentId: true, grade: true }, orderBy: { studentId: "asc" } })
  }

  async function expectUpgraded({ g5, g12, g8, s }: Awaited<ReturnType<typeof seed>>) {
    expect(await links(s.past.id)).toEqual([{ studentId: g5.id, grade: 5 }, { studentId: g12.id, grade: 12 }])
    expect(await links(s.endedToday.id)).toEqual([{ studentId: g5.id, grade: 5 }, { studentId: g12.id, grade: 12 }])
    expect(await links(s.laterToday.id)).toEqual([{ studentId: g5.id, grade: 6 }])
    expect(await links(s.future.id)).toEqual([{ studentId: g5.id, grade: 6 }, { studentId: g8.id, grade: 8 }])
    // Ca không còn HS vẫn giữ (spec P Q8).
    expect(await links(s.onlyG12.id)).toEqual([])
    expect(await db.teachingSession.findUnique({ where: { id: s.onlyG12.id } })).not.toBeNull()
  }

  it("manual: HS lên lớp mang khối mới ở ca chưa kết thúc; HS lớp 12 bị gỡ; ca đã qua/đã dạy giữ nguyên", async () => {
    const ctx = await seed()
    const res = await ctx.caller.student.upgradeAllClasses()
    expect(res).toMatchObject({ upgradedCount: 1, deactivatedCount: 1, year: 2099 })
    await expectUpgraded(ctx)
  }, 60_000)

  it("auto qua auth.me (từ tháng 7) cho cùng kết quả", async () => {
    const ctx = await seed()
    await ctx.caller.auth.me()
    await expectUpgraded(ctx)
  }, 60_000)

  it("không đụng ca của giáo viên khác", async () => {
    const ctx = await seed()
    const other = await getAuthedCaller("teacher2")
    const otherSubject = (await other.subject.list({}))[0].id
    const st = await other.student.create({ fullName: "HS Khac", grade: 5, tuitionFee: 0, isActive: true })
    const ses = await other.session.create({ sessionDate: "2099-07-20", startTime: "10:00", endTime: "11:00", subjectId: otherSubject, studentIds: [st.id] })
    await ctx.caller.student.upgradeAllClasses()
    expect(await links(ses.id)).toEqual([{ studentId: st.id, grade: 5 }])
  }, 60_000)
})
```
(Nếu `teacher2` chưa có môn nào → tạo bằng `other.subject.create({ name: "Toán K", color: "#0891B2" })`, ghi Ruling. Nếu `session.create` từ chối HS đã nghỉ → thứ tự trong `seed` đã tạo ca trước rồi mới tắt `isActive` nên không gặp.)

Run: `pnpm test tests/integration/student-upgrade.test.ts`
Expected: FAIL 2 ca đầu khối mới (`laterToday` còn `grade: 5` và còn HS lớp 12); ca "không đụng ca của giáo viên khác" có thể PASS (hồi quy).

- [ ] **Step 6: Sửa `student.service.ts`**

Thêm import và hàm nội bộ (đặt ngay trên `updateStudent`):
```ts
import { hasSessionEnded, vnToday } from "@/lib/session-time"
```
```ts
// Link HS ↔ ca CHƯA kết thúc theo giờ VN; ca đã dạy (kể cả sáng nay) là lịch sử, không được đụng.
async function findUnfinishedLinks(tx: Prisma.TransactionClient, userId: number, studentIds: number[], now: Date) {
  if (studentIds.length === 0) return []
  const links = await tx.sessionStudent.findMany({
    where: { studentId: { in: studentIds }, session: { userId, sessionDate: { gte: vnToday(now) } } },
    select: { id: true, studentId: true, session: { select: { sessionDate: true, endTime: true } } },
  })
  return links.filter((l) => !hasSessionEnded(l.session, now))
}
```

`updateStudent`: thay toàn bộ khối `if (data.grade !== undefined && data.grade !== existing.grade) { … }` (từ `const now = new Date()` tới hết `updateMany`) bằng:
```ts
    // Đổi grade → đồng bộ snapshot grade các buổi chưa kết thúc; buổi đã dạy giữ grade lịch sử.
    if (data.grade !== undefined && data.grade !== existing.grade) {
      const toSync = (await findUnfinishedLinks(tx, userId, [id], new Date())).map((l) => l.id)
      if (toSync.length > 0) {
        await tx.sessionStudent.updateMany({ where: { id: { in: toSync } }, data: { grade: data.grade } })
      }
    }
```

`softDeleteStudent`: xoá khối `// Mốc "hôm nay" theo UTC…` + `const now`/`todayUTC`; thân transaction thành:
```ts
  await db.$transaction(async (tx) => {
    // Chỉ gỡ khỏi buổi chưa kết thúc: buổi đã dạy giữ để bảo toàn điểm danh & doanh thu.
    const toRemove = (await findUnfinishedLinks(tx, userId, [id], new Date())).map((l) => l.id)
    if (toRemove.length > 0) {
      await tx.sessionStudent.deleteMany({ where: { id: { in: toRemove } } })
    }
    await tx.student.update({ where: { id }, data: { isActive: false } })
  })
```

`upgradeAllClasses`: đầu hàm `const now = new Date()` và `const year = now.getUTCFullYear()` (giữ năm UTC, spec Q10). Trong transaction, thay đoạn từ `const upgraded = await tx.student.updateMany(...)` tới trước `await tx.classUpgradeLog.create` bằng:
```ts
      const upgrading = await tx.student.findMany({
        where: { userId, isActive: true, grade: { gte: 1, lte: 11 } },
        select: { id: true, grade: true },
      })
      const upgraded = await tx.student.updateMany({
        where: { id: { in: upgrading.map((s) => s.id) } },
        data: { grade: { increment: 1 } },
      })
      const deactivated = graduatingIds.length > 0
        ? await tx.student.updateMany({
            where: { id: { in: graduatingIds } },
            data: { isActive: false },
          })
        : { count: 0 }

      // Ca chưa kết thúc (giờ VN): HS lên lớp mang khối mới, HS ra trường bị gỡ; ca trống vẫn giữ (spec P Q8).
      const newGrade = new Map(upgrading.map((s) => [s.id, s.grade + 1]))
      const links = await findUnfinishedLinks(tx, userId, [...newGrade.keys(), ...graduatingIds], now)
      const byGrade = new Map<number, number[]>()
      const toRemove: number[] = []
      for (const l of links) {
        const g = newGrade.get(l.studentId)
        if (g === undefined) toRemove.push(l.id)
        else byGrade.set(g, [...(byGrade.get(g) ?? []), l.id])
      }
      for (const [grade, ids] of byGrade) {
        await tx.sessionStudent.updateMany({ where: { id: { in: ids } }, data: { grade } })
      }
      if (toRemove.length > 0) {
        await tx.sessionStudent.deleteMany({ where: { id: { in: toRemove } } })
      }
```
và thêm tham số thứ 2 cho `db.$transaction(async (tx) => { … }, { timeout: 15000 })` (nhiều ca tương lai qua Neon sin1). Giữ nguyên khối `graduatingStudents`, check log trong transaction và `catch P2002`.

- [ ] **Step 7: Chạy test, sửa test cũ mâu thuẫn spec P5**

Run: `pnpm test tests/unit/lib/session-time.test.ts` → PASS.
Run: `pnpm test tests/integration/student-delete-schedule-sync.test.ts` → PASS toàn bộ.
Run: `pnpm test tests/integration/student-upgrade.test.ts`
Expected: các ca mới PASS. Ca cũ `"preserves historical grade after upgradeAllClasses"` tạo ca `2099-02-15` (tương lai theo giờ thật) và kỳ vọng `grade` 3 sau lên lớp → nay đúng spec là 4: đổi `sessionDate` thành `"2020-02-15"` (ca quá khứ, giữ ý "lịch sử giữ khối cũ"), giữ kỳ vọng 3. Ca `"populates grade snapshot from current Student.grade on session create"` (ca `2099-01-15` + `monthlySummary` năm 2099) nếu đỏ vì lý do tương tự → đổi ca sang `"2020-01-15"` và truy vấn `{ year: 2020, month: 1, grade: 3 }` / `grade: 4` cho khớp tháng của ca; nếu đã đỏ ở mốc Step 1 → giữ nguyên, ghi báo cáo. Mọi chỗ sửa test cũ ghi "Ruling" kèm lý do "spec P5: ca chưa kết thúc mang khối mới".
Run lại cả file → PASS (trừ ca đỏ sẵn ở mốc).

- [ ] **Step 8: Quét sót + tsc + lint**

Run (Bash):
```bash
grep -n "getUTCDate()\|todayUTC\|nowMs" src/server/services/student.service.ts
pnpm exec tsc --noEmit
pnpm lint
```
Expected: lệnh 1 không in gì; tsc, lint sạch.

- [ ] **Step 9: Commit**

```bash
git add src/lib/session-time.ts src/server/services/student.service.ts tests/unit/lib/session-time.test.ts tests/integration/student-delete-schedule-sync.test.ts tests/integration/student-upgrade.test.ts
git commit -m "fix(p): so ca đã kết thúc theo giờ VN (xoá HS, đổi khối); tự lên lớp cập nhật khối và gỡ HS lớp 12 khỏi ca chưa kết thúc

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 3: HS đã nghỉ còn nợ hiện ở "Cần chú ý" kèm nhãn "Đã nghỉ" (P1)

**Đọc trước:** Global Constraints; spec mục 3.1, Q1–Q3; `src/server/services/report.service.ts` (`DashboardAlerts`, `countDebtMonths`, `getDashboardAlerts`); `src/server/services/tuition.service.ts` (`getMonthlyTuitionStatus` toàn bộ, `getMonthlyOutstanding`); `src/components/dashboard/DashboardAlerts.tsx`; `tests/integration/dashboard-alerts.test.ts` (toàn bộ, nhất là describe "còn nợ tháng trước" và "an toàn"); `tests/unit/components/DashboardAlerts.test.tsx`; `tests/e2e/dashboard-alerts.spec.ts`; spec D `docs/superpowers/specs/2026-09-25-d-canh-bao-dashboard-design.md` mục S5/R2 (luật cũ đang đổi).

**Files:**
- Modify: `src/server/services/tuition.service.ts` (chỉ chữ ký + điều kiện lấy HS của `getMonthlyTuitionStatus`)
- Modify: `src/server/services/report.service.ts`
- Modify: `src/components/dashboard/DashboardAlerts.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json` (đổi `alert_debt_desc`)
- Test (Sửa): `tests/integration/dashboard-alerts.test.ts`, `tests/unit/components/DashboardAlerts.test.tsx`, `tests/e2e/dashboard-alerts.spec.ts`

**Interfaces:**
- Consumes: không (độc lập Task 2).
- Produces:
  - `getMonthlyTuitionStatus(db, userId, filter, persist = true, onlyStudentIds?: number[])` — tham số thứ 5 mới, tùy chọn; 4 tham số cũ giữ nguyên hành vi.
  - `DashboardAlerts.debts[number]` = `{ studentId: number; fullName: string; grade: number; amount: number; months: number; isActive: boolean }` (client đọc qua `RouterOutputs["report"]["alerts"]`).

- [ ] **Step 1: Xác nhận DB test**

Run (Bash): `h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"`
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Integration (RED)**

Trong `tests/integration/dashboard-alerts.test.ts`, describe `"getDashboardAlerts — còn nợ tháng trước"`:
1. Hai ca đang `toEqual` nguyên object nợ (`"số tiền khớp cột Dư nợ tháng trước…"` và `"nợ liên tiếp 6, 7, 8 → 3 tháng…"`): thêm `isActive: true` vào từng object kỳ vọng.
2. Thay ca `"HS đã nghỉ (isActive=false) còn nợ và không có ca → không xuất hiện ở nhóm nào"` bằng 3 ca:
```ts
  it("HS đã nghỉ còn nợ, KHÔNG có ca tháng này → có trong nhóm nợ, isActive=false, số tiền khớp màn Học phí (spec P1)", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Đã Nghỉ", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    await db.student.update({ where: { id: st.id }, data: { isActive: false } })

    const alerts = await getDashboardAlerts(db, userId, NOW)
    const page = await caller.tuition.getMonthlyStatus({ year: 2026, month: 9, studentId: st.id, limit: 1 })

    expect(page.items[0].previousBalance).toBe(100000)
    expect(alerts.debts).toEqual([
      { studentId: st.id, fullName: "HS Đã Nghỉ", grade: 6, amount: 100000, months: 1, isActive: false },
    ])
    // Nhóm "lâu không có ca" vẫn chỉ HS đang học.
    expect(alerts.idleStudents).toEqual([])
  })

  it("HS đã nghỉ vẫn có ca tháng này → chỉ 1 dòng nợ", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Nghỉ Có Ca", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    await addSession(caller, { date: "2026-09-02", studentIds: [st.id], presentFee: 100000 })
    await db.student.update({ where: { id: st.id }, data: { isActive: false } })

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts).toEqual([
      { studentId: st.id, fullName: "HS Nghỉ Có Ca", grade: 6, amount: 100000, months: 1, isActive: false },
    ])
  })

  it("HS đã nghỉ không còn nợ → không xuất hiện", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Nghỉ Sạch Nợ", grade: 6 })
    await db.student.update({ where: { id: st.id }, data: { isActive: false } })
    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })
```
3. Trong describe `"getDashboardAlerts — an toàn"`: ở ca `"không ghi DB…"` thêm 1 HS đã nghỉ còn nợ (tạo như ca 1 ở trên, trước khi đếm `monthlyTuition` lần đầu) để lượt 2 cũng được kiểm là không ghi; ở ca `"đa người dùng…"` thêm 1 HS **đã nghỉ** còn nợ của giáo viên kia (tạo bằng `getAuthedCaller("teacher2")`) và khẳng định không có trong `debts` của `teacher`. (Đọc 2 ca đó trước, chèn đúng biến có sẵn; không đổi kỳ vọng cũ.)

Run: `pnpm test tests/integration/dashboard-alerts.test.ts`
Expected: FAIL — 2 ca `toEqual` cũ (thiếu `isActive`), ca "KHÔNG có ca tháng này" (`debts` rỗng), ca "vẫn có ca tháng này" (rỗng). Ca "không còn nợ" PASS.

- [ ] **Step 3: `getMonthlyTuitionStatus` nhận `onlyStudentIds`**

Trong `src/server/services/tuition.service.ts`, chữ ký thêm tham số cuối:
```ts
  persist = true,
  // Dashboard (spec P1): chỉ tính cho các HS này, bỏ lọc isActive/grade của danh sách màn Học phí.
  onlyStudentIds?: number[]
): Promise<PaginatedResponse<TuitionStatusDTO>> {
  const { year, month, grade, search, studentId, status, page, limit } = filter
  if (onlyStudentIds && onlyStudentIds.length === 0) return { items: [], totalCount: 0, totalPages: 0 }
```
và `where` của `db.student.findMany` ở bước 1 thành:
```ts
    where: onlyStudentIds
      ? { userId, id: { in: onlyStudentIds } }
      : {
          userId,
          /* giữ NGUYÊN khối ...(studentId ? … : grade ? … : { OR: … }) và ...(search ? … : {}) hiện có */
        },
```
(Chỉ bọc khối cũ vào nhánh `:`; không đổi nội dung khối cũ.)

- [ ] **Step 4: `getDashboardAlerts` gộp HS đã nghỉ**

Trong `src/server/services/report.service.ts`:
- Kiểu: `debts: { studentId: number; fullName: string; grade: number; amount: number; months: number; isActive: boolean }[]`.
- Trong `Promise.all`, thay phần tử `db.student.findMany({ where: { userId, isActive: true }, select: { id: true } })` bằng `db.student.findMany({ where: { userId, isActive: false }, select: { id: true } })`, đổi tên biến destructure `activeStudents` → `inactiveStudents`.
- Thay đoạn từ `const activeIds = …` tới hết `.filter((d) => d.amount > 0)` bằng:
```ts
  const inactiveIds = new Set(inactiveStudents.map((s) => s.id))
  // Danh sách màn Học phí không có HS đã nghỉ mà tháng này không có ca → tính riêng lượt 2 (spec P1).
  const listed = new Set(tuition.items.map((it) => it.studentId))
  const missing = [...inactiveIds].filter((id) => !listed.has(id))
  const extra =
    missing.length > 0
      ? (await getMonthlyTuitionStatus(db, userId, { year, month, status: "all", page: 1, limit: 1_000_000 }, false, missing)).items
      : []

  // Tiền thu tháng này trừ vào nợ cũ trước; tháng này đã tất toán thì coi như hết nợ (spec S2).
  const debtors = [...tuition.items, ...extra]
    .filter((it) => it.previousBalance > 0 && !it.isFullPaid)
    .map((it) => ({
      studentId: it.studentId,
      fullName: it.fullName,
      grade: it.grade,
      amount: Math.min(it.previousBalance, it.totalAmountDue - it.paidAmount),
      isActive: !inactiveIds.has(it.studentId),
    }))
    .filter((d) => d.amount > 0)
```
Phần `countDebtMonths` / sắp xếp / `return` giữ nguyên.

Run: `pnpm test tests/integration/dashboard-alerts.test.ts` → PASS toàn bộ.
Run: `pnpm test tests/integration/tuition.test.ts` rồi `pnpm test tests/integration/tuition-report-consistency.test.ts`
Expected: PASS (4 tham số cũ không đổi hành vi).

- [ ] **Step 5: UI nhãn "Đã nghỉ" (RED → GREEN)**

Trong `tests/unit/components/DashboardAlerts.test.tsx`: fixture `alerts.debts[0]` thêm `isActive: true`. Thêm:
```tsx
describe("DashboardAlerts — HS đã nghỉ còn nợ (spec P1)", () => {
  it("dòng HS đã nghỉ có nhãn xám Đã nghỉ; HS đang học không có", () => {
    alerts.debts.push({ studentId: 9, fullName: "Lê Cường", grade: 7, amount: 900000, months: 1, isActive: false })
    try {
      render(
        <LanguageProvider forcedLanguage="vi">
          <DashboardAlerts />
        </LanguageProvider>
      )
      const rows = within(screen.getByTestId("alert-group-debt")).getAllByTestId("alert-row")
      expect(within(rows[0]).queryByTestId("alert-debt-inactive")).toBeNull()
      const badge = within(rows[1]).getByTestId("alert-debt-inactive")
      expect(badge.textContent).toBe("Đã nghỉ")
      expect(badge.className).toContain("bg-slate-100")
    } finally {
      alerts.debts.pop()
    }
  })
})
```
Run: `pnpm test tests/unit/components/DashboardAlerts.test.tsx`
Expected: FAIL — không tìm thấy `alert-debt-inactive`.

`src/components/dashboard/DashboardAlerts.tsx`, `renderRow` nhóm nợ: chèn ngay sau `<p className="min-w-0 flex-1 truncate text-sm">…</p>` (trước `<div className="shrink-0 text-right">`):
```tsx
                  {!d.isActive && (
                    <Badge
                      variant="outline"
                      data-testid="alert-debt-inactive"
                      className="shrink-0 whitespace-nowrap border-slate-200 bg-slate-100 text-slate-600"
                    >
                      {t("dropped")}
                    </Badge>
                  )}
```
i18n: `alert_debt_desc` vi → `"Học sinh còn nợ học phí cũ, kể cả đã nghỉ"`, en → `"Students with earlier unpaid tuition, including dropped ones"`.

Run: `pnpm test tests/unit/components/DashboardAlerts.test.tsx` → PASS. Ca nào khẳng định chữ mô tả cũ → đổi sang chữ mới.

- [ ] **Step 6: E2E (390px)**

Thêm vào `tests/e2e/dashboard-alerts.spec.ts` (trong `test.describe` sẵn có, dùng `trpcMutation`/`trpcQuery` và mảng dọn dẹp sẵn có):
```ts
  test('HS đã nghỉ còn nợ → vẫn ở nhóm nợ, có nhãn Đã nghỉ, bấm mở đúng HS ở Học phí', async ({ page }) => {
    const name = `E2E HS đã nghỉ còn nợ ${Date.now()}`;
    const fee = 8_800_000;
    const subjects = await trpcQuery<{ id: number }[]>(page, 'subject.list', { isActive: true });
    const student = await trpcMutation<{ id: number }>(page, 'student.create', { fullName: name, grade: 7, tuitionFee: fee });
    createdStudentIds.push(student.id);
    const hour = String(Math.floor(Math.random() * 12) + 6).padStart(2, '0');
    const session = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: dayInPreviousVnMonth(), startTime: `${hour}:10`, endTime: `${hour}:50`, subjectId: subjects[0].id,
    });
    createdSessionIds.push(session.id);
    await trpcMutation(page, 'session.addStudents', { sessionId: session.id, studentIds: [student.id] });
    await trpcMutation(page, 'attendance.update', {
      sessionId: session.id,
      attendances: [{ studentId: student.id, attendance: 'present', fee }],
    });
    // Cho nghỉ học: ca tháng trước đã qua nên vẫn giữ điểm danh → vẫn còn nợ.
    await trpcMutation(page, 'student.delete', { id: student.id });

    await page.goto('/dashboard');
    const debtGroup = page.getByTestId('alert-group-debt');
    const viewAll = debtGroup.getByRole('button', { name: /Xem tất cả/ });
    if (await viewAll.isVisible()) await viewAll.click();
    const row = debtGroup.getByTestId('alert-row').filter({ hasText: name });
    await expect(row.getByTestId('alert-debt-inactive')).toHaveText('Đã nghỉ');
    await expect(row).toContainText('8.800.000');
    await expectNoHorizontalScroll(page);
    await row.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/tuition\\?.*studentId=${student.id}`));
    await expect(page.getByRole('dialog')).toContainText(name);
  });
```
(`afterEach` sẵn có xoá ca rồi gọi `student.delete` lại trên HS đã nghỉ; nếu lỗi thì bỏ `createdStudentIds.push` và ghi Ruling.)

Run (Bash):
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/dashboard-alerts.spec.ts
```
Expected: 3 test passed.

- [ ] **Step 7: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` và `pnpm lint` → sạch.
```bash
git add src/server/services/tuition.service.ts src/server/services/report.service.ts src/components/dashboard/DashboardAlerts.tsx src/language/vi.json src/language/en.json tests/integration/dashboard-alerts.test.ts tests/unit/components/DashboardAlerts.test.tsx tests/e2e/dashboard-alerts.spec.ts
git commit -m "fix(p): Cần chú ý hiện HS đã nghỉ còn nợ (nhãn Đã nghỉ), tính riêng HS nghỉ không có ca tháng này

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 4: Hết React #418 (giờ build), màu Excel về #0F766E, ca huỷ luôn đỏ (P2, P3, P4)

**Đọc trước:** Global Constraints; spec mục 3.2, 3.3, 3.4, Q4–Q7; `next.config.mjs`; `src/components/layout/AppSidebar.tsx` và `src/components/admin/AdminSidebar.tsx` (cuối file, giờ build); `src/lib/constants.ts` (`COLORS`); `src/hooks/useExcelExport.ts` (đầu file); `src/lib/student-import-excel.ts` (`HEADER_BG`); `src/server/services/backup.service.ts` (`HEADER_BG`); `tests/unit/theme-legacy-colors.test.ts`; `src/components/calendar/SessionCard.tsx`; `src/app/globals.css` (khối `.session-card`); `tests/unit/components/SessionCard.test.tsx`.

**Files:**
- Modify: `next.config.mjs`
- Modify: `src/lib/constants.ts`, `src/hooks/useExcelExport.ts`, `src/lib/student-import-excel.ts`, `src/server/services/backup.service.ts`
- Modify: `src/components/calendar/SessionCard.tsx`
- Test (Mới): `tests/unit/next-config-build-time.test.ts`
- Test (Sửa): `tests/unit/theme-legacy-colors.test.ts`, `tests/unit/components/SessionCard.test.tsx`

**Interfaces:**
- Consumes: không.
- Produces: `process.env.APP_BUILD_TIMESTAMP` (chuỗi số ms) do `next.config.mjs` tự đặt nếu chưa có; `COLORS.primary === "#0F766E"`. Task 9 dựa vào: sau `next build` chỉ có 1 giá trị giờ build.

- [ ] **Step 1: Xác nhận DB test** (unit cũng chạy `tests/setup.ts`) — lệnh như Task 3 Step 1.

- [ ] **Step 2: Test giờ build (RED)**

Tạo `tests/unit/next-config-build-time.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const KEY = "APP_BUILD_TIMESTAMP"
const saved = process.env[KEY]

// next build nạp next.config.mjs lại trong từng worker (server/client); mô phỏng bằng resetModules + import lại.
async function loadBuildTime(): Promise<string | undefined> {
  vi.resetModules()
  const mod = await import("../../next.config.mjs")
  return mod.default.env?.NEXT_PUBLIC_BUILD_TIME
}

beforeEach(() => {
  delete process.env[KEY]
  vi.useFakeTimers({ toFake: ["Date"] })
})
afterEach(() => {
  vi.useRealTimers()
  if (saved === undefined) delete process.env[KEY]
  else process.env[KEY] = saved
})

describe("next.config — giờ build chung cho mọi worker (spec P2)", () => {
  it("nạp lần 2 sau 2 phút vẫn cùng giờ build (bundle server và client không lệch → hết #418)", async () => {
    vi.setSystemTime(new Date("2026-09-27T07:15:30Z"))
    const first = await loadBuildTime()
    vi.setSystemTime(new Date("2026-09-27T07:17:30Z"))
    const second = await loadBuildTime()
    expect(first).toBe("27/09/2026 14:15")
    expect(second).toBe(first)
  })

  it("APP_BUILD_TIMESTAMP có sẵn (worker con thừa hưởng từ tiến trình chính) → dùng đúng mốc đó", async () => {
    process.env[KEY] = String(Date.parse("2026-12-31T17:05:00Z"))
    expect(await loadBuildTime()).toBe("01/01/2027 00:05")
  })
})
```
Run: `pnpm test tests/unit/next-config-build-time.test.ts`
Expected: FAIL — ca 1 `second` = `"27/09/2026 14:17"`; ca 2 ra giờ giả hiện tại. Nếu ca 1 không đỏ vì module không nạp lại (resetModules không tác dụng) → đổi thành ``import(`../../next.config.mjs?v=${Math.random()}`)`` và ghi Ruling.

- [ ] **Step 3: Sửa `next.config.mjs`**

Thay dòng `const vn = new Date(Date.now() + 7 * 60 * 60 * 1000)` bằng:
```js
// next build nạp file này lại trong từng worker (server/client): tính giờ riêng mỗi nơi sẽ lệch → React #418 ở sidebar.
// Chốt 1 mốc ở tiến trình chính, worker con thừa hưởng qua env.
process.env.APP_BUILD_TIMESTAMP ||= String(Date.now())
const vn = new Date(Number(process.env.APP_BUILD_TIMESTAMP) + 7 * 60 * 60 * 1000)
```
Run: `pnpm test tests/unit/next-config-build-time.test.ts` → PASS 2 test.

- [ ] **Step 4: Test hex màu nhấn cũ (RED)**

`tests/unit/theme-legacy-colors.test.ts`: import `join, relative, sep` từ `node:path`; thêm trong `describe`:
```ts
  // Hex Tailwind indigo/violet/purple (kể cả dạng ARGB "FF…" của exceljs) — màu nhấn trước A3 (spec P3).
  const LEGACY_HEX =
    /(?<![0-9a-f])(?:FF)?(4F46E5|4338CA|6366F1|818CF8|A5B4FC|C7D2FE|E0E7FF|EEF2FF|7C3AED|6D28D9|8B5CF6|A78BFA|DDD6FE|EDE9FE|9333EA|A855F7|C084FC|E9D5FF|F3E8FF)(?![0-9a-f])/i
  // Bảng màu MÔN HỌC là dữ liệu người dùng chọn, không phải màu nhấn giao diện (spec P Q6).
  const SUBJECT_COLOR_FILES = ["lib/subject-colors.ts", "lib/schemas/subject.ts", "server/services/subject-defaults.ts"]

  it("src/ không còn hex indigo/violet/purple (trừ bảng màu môn học)", () => {
    const hits = walk(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .filter((f) => !SUBJECT_COLOR_FILES.includes(relative(SRC, f).split(sep).join("/")))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((line, i) => (LEGACY_HEX.test(line) ? [`${relative(SRC, f)}:${i + 1}: ${line.trim()}`] : []))
      )
    expect(hits).toEqual([])
  })
```
Run: `pnpm test tests/unit/theme-legacy-colors.test.ts`
Expected: FAIL, `hits` đúng 4 dòng: `lib/constants.ts` (`primary: "#4F46E5"`), `hooks/useExcelExport.ts` (`headerBg`), `lib/student-import-excel.ts` (`HEADER_BG`), `server/services/backup.service.ts` (`HEADER_BG`). Có dòng khác → là màu nhấn giao diện thì sửa sang teal ở Step 5 và ghi báo cáo; là dữ liệu/không phải màu → DỪNG, báo (không tự nới regex).

- [ ] **Step 5: Đổi màu**

- `src/lib/constants.ts`: `primary: "#4F46E5",` → `primary: "#0F766E",`
- `src/hooks/useExcelExport.ts`: `headerBg: "FFE0E7FF",` → `headerBg: "FFCCFBF1",`
- `src/lib/student-import-excel.ts`: `"FFE0E7FF"` → `"FFCCFBF1"` (giữ ghi chú cuối dòng)
- `src/server/services/backup.service.ts`: `const HEADER_BG = "FFE0E7FF"` → `const HEADER_BG = "FFCCFBF1"`

Run: `pnpm test tests/unit/theme-legacy-colors.test.ts` → PASS 2 test.
Run: `pnpm test tests/unit/lib/student-import-excel.test.ts` rồi `pnpm test tests/integration/backup.test.ts`
Expected: PASS (`#4F46E5` trong `backup.test.ts` là màu **môn** seed, không đổi). Ca nào khẳng định `FFE0E7FF` → đổi sang `FFCCFBF1`.

- [ ] **Step 6: Ca huỷ luôn đỏ (RED → GREEN)**

Thêm vào `tests/unit/components/SessionCard.test.tsx`:
```tsx
describe("SessionCard — ca đã huỷ luôn đỏ, không bị màu cấp học đè (spec P4)", () => {
  it.each(["tieu_hoc", "thcs", "thpt", "mixed"] as const)("%s + cancelled", (level) => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionCard session={{ ...base, level, status: "cancelled", cancelledAt: new Date() }} />
      </LanguageProvider>
    )
    const cls = screen.getByRole("button").className
    expect(cls).not.toMatch(/session-card--/)
    expect(cls).not.toContain("bg-slate-100")
    expect(cls).toContain("bg-red-50")
    expect(cls).toContain("border-red-300")
  })
})
```
Run: `pnpm test tests/unit/components/SessionCard.test.tsx`
Expected: FAIL 3 ca `tieu_hoc`/`thcs`/`thpt`; `mixed` PASS (tailwind-merge đã gỡ `bg-slate-100`).

`src/components/calendar/SessionCard.tsx`, khối `cn(...)` của `<button>`:
```tsx
      className={cn(
        "session-card text-left w-full",
        // .session-card--* nằm ngoài @layer nên đè utility đỏ, tailwind-merge không gỡ được: ca huỷ không gắn màu cấp.
        !isCancelled && level === "tieu_hoc" && "session-card--tieu-hoc",
        !isCancelled && level === "thcs" && "session-card--thcs",
        !isCancelled && level === "thpt" && "session-card--thpt",
        !isCancelled && level === "mixed" && "border-slate-500 bg-slate-100",
        isCancelled && "opacity-60 border-red-300 bg-red-50"
      )}
```
Run: `pnpm test tests/unit/components/SessionCard.test.tsx` → PASS.

- [ ] **Step 7: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` và `pnpm lint` → sạch.
```bash
git add next.config.mjs src/lib/constants.ts src/hooks/useExcelExport.ts src/lib/student-import-excel.ts src/server/services/backup.service.ts src/components/calendar/SessionCard.tsx tests/unit/next-config-build-time.test.ts tests/unit/theme-legacy-colors.test.ts tests/unit/components/SessionCard.test.tsx
git commit -m "fix(p): chốt giờ build 1 lần cho mọi worker (hết React #418), màu Excel về teal, ca huỷ không bị màu cấp học đè

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 5: Đơn chờ quá 7 ngày → "Hết hạn" (không cron), `admin.pendingCount` cho sidebar + tab bar (P7, J4, J5)

**Đọc trước:** Global Constraints; spec mục 3.7, 3.8 (J4, J5), Q11–Q15; `prisma/schema.prisma` (model `PlanOrder`: `status VarChar(10)`, `@@map("plan_orders")`, cột `user_id`, `created_at`, `decided_at`); `src/lib/plans.ts` (`addDays`, `DAY_MS`); `src/server/services/plan.service.ts` (toàn bộ); `src/server/services/plan-admin.service.ts` (toàn bộ); `src/server/trpc/routers/admin.ts`; `src/app/(app)/plan/page.tsx` (`STATUS_KEY`); `src/components/plan/PendingOrderCard.tsx`; `src/components/admin/AdminOrderHistory.tsx`, `AdminPendingOrders.tsx`, `AdminSidebar.tsx`, `AdminTabBar.tsx`, `admin-format.ts` (`dateTimeVn`); `tests/integration/plan-orders.test.ts`, `tests/integration/admin.test.ts` (đầu file: `reset`, env); `tests/unit/components/AdminNav.test.tsx`; `tests/unit/components/PlanPurchaseDialog.test.tsx` (fixture `pendingOrder`); `tests/e2e/plan.spec.ts` (đầu file: `db`, `login`, `resetStd`).

**Files:**
- Modify: `src/lib/plans.ts`, `src/server/services/plan.service.ts`, `src/server/services/plan-admin.service.ts`, `src/server/trpc/routers/admin.ts`
- Modify: `src/app/(app)/plan/page.tsx`, `src/components/plan/PendingOrderCard.tsx`, `src/components/admin/AdminOrderHistory.tsx`, `src/components/admin/AdminPendingOrders.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/components/admin/AdminTabBar.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Sửa): `tests/unit/lib/plans.test.ts`, `tests/integration/plan-orders.test.ts`, `tests/integration/admin.test.ts`, `tests/unit/components/AdminNav.test.tsx`, `tests/unit/components/PlanPurchaseDialog.test.tsx` (fixture), `tests/e2e/plan.spec.ts`

**Interfaces:**
- Consumes: không.
- Produces:
  - `src/lib/plans.ts`: `ORDER_TTL_DAYS = 7`; `orderExpiresAt(createdAt: Date): Date`.
  - `plan.service.ts`: `expireStaleOrders(db: Db, now: Date, userId?: number): Promise<number>`.
  - `plan-admin.service.ts`: `getPendingCount(db: PrismaClient): Promise<{ count: number }>`.
  - tRPC: `admin.pendingCount` (query, không input) → `{ count: number }`.
  - `plan.me.pendingOrder.expiresAt` và `admin.overview.pendingOrders[number].expiresAt` (server `Date`, client chuỗi ISO).
  - Trạng thái đơn mới `"expired"`; key i18n `plan_status_expired`, `plan_order_expires`, `admin_order_expires`.

- [ ] **Step 1: Xác nhận DB test** — lệnh như Task 3 Step 1.

- [ ] **Step 2: Unit `orderExpiresAt` (RED)**

Thêm vào `tests/unit/lib/plans.test.ts` (import thêm `ORDER_TTL_DAYS, orderExpiresAt` từ `@/lib/plans`):
```ts
describe("orderExpiresAt (spec P7)", () => {
  it("đúng 7 × 24 giờ sau lúc tạo, không làm tròn ngày VN", () => {
    expect(ORDER_TTL_DAYS).toBe(7)
    expect(orderExpiresAt(new Date("2026-09-20T10:15:00.000Z")).toISOString()).toBe("2026-09-27T10:15:00.000Z")
  })
})
```
Run: `pnpm test tests/unit/lib/plans.test.ts` → FAIL (export không tồn tại).

Thêm vào `src/lib/plans.ts` ngay dưới `addDays`:
```ts
// Đơn chờ chuyển khoản quá 7 ngày chưa duyệt thì hết hạn (spec P7), tính đúng từ giờ tạo.
export const ORDER_TTL_DAYS = 7
export function orderExpiresAt(createdAt: Date): Date {
  return addDays(createdAt, ORDER_TTL_DAYS)
}
```
Run lại → PASS.

- [ ] **Step 3: Integration phía giáo viên (RED)**

Thêm vào cuối `tests/integration/plan-orders.test.ts`:
```ts
const DAY = 24 * 60 * 60 * 1000
async function backdate(id: number, ms: number) {
  await db.planOrder.update({ where: { id }, data: { createdAt: new Date(Date.now() - ms) } })
}

describe("đơn chờ hết hạn sau 7 ngày (spec P7)", () => {
  it("quá 7 ngày → plan.me không còn pendingOrder; đơn thành expired, decidedAt = createdAt + 7 ngày, decidedBy null", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(id, 7 * DAY + 60_000)
    const me = await c.plan.me()
    expect(me.pendingOrder).toBeNull()
    expect(me.orders.find((o) => o.id === id)?.status).toBe("expired")
    const row = await db.planOrder.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe("expired")
    expect(row.decidedAt?.getTime()).toBe(row.createdAt.getTime() + 7 * DAY)
    expect(row.decidedBy).toBeNull()
  })

  it("6 ngày 23 giờ → vẫn pending, pendingOrder.expiresAt = createdAt + 7 ngày", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(id, 7 * DAY - 60 * 60 * 1000)
    const me = await c.plan.me()
    const row = await db.planOrder.findUniqueOrThrow({ where: { id } })
    expect(me.pendingOrder?.id).toBe(id)
    expect(new Date(me.pendingOrder!.expiresAt).getTime()).toBe(row.createdAt.getTime() + 7 * DAY)
  })

  it("tạo đơn mới khi đơn cũ đã quá hạn → đơn cũ expired (không phải cancelled)", async () => {
    const c = await getAuthedCaller("teacher_std")
    const first = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(first.id, 8 * DAY)
    await c.plan.createOrder({ plan: "plus", period: "month" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("expired")
  })

  it("hủy đơn đã quá hạn → NOT_FOUND, trạng thái expired", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(id, 8 * DAY)
    await expect(c.plan.cancelOrder({ id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).status).toBe("expired")
  })

  it("plan.me của user này không expire đơn quá hạn của user khác", async () => {
    const other = await getAuthedCaller("teacher")
    const { id } = await other.plan.createOrder({ plan: "pro", period: "year" })
    await backdate(id, 8 * DAY)
    await (await getAuthedCaller("teacher_std")).plan.me()
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).status).toBe("pending")
  })
})
```
(Nếu `cancelOrder` nhận input khác `{ id }` hoặc `teacher` bị chặn đặt Pro → đọc router `plan`, chỉnh cho khớp, ghi Ruling.)

Run: `pnpm test tests/integration/plan-orders.test.ts`
Expected: FAIL ca 1 (còn pendingOrder), ca 2 (`expiresAt` undefined → TS có thể báo lỗi kiểu: vẫn FAIL), ca 3 (`cancelled`), ca 4 (`cancelled`→ status sai hoặc không NOT_FOUND). Ca 5 PASS.

- [ ] **Step 4: Hết hạn lười ở `plan.service.ts`**

Import thêm `ORDER_TTL_DAYS, addDays, orderExpiresAt` từ `@/lib/plans`. Thêm (dưới `findLastPlusOrder`):
```ts
// Không có cron: đơn chờ quá hạn được chốt "expired" ở lần đọc/ghi kế tiếp; decided_at = đúng lúc hết hạn (spec P7).
export async function expireStaleOrders(db: Db, now: Date, userId?: number): Promise<number> {
  const cutoff = addDays(now, -ORDER_TTL_DAYS)
  const byUser = userId === undefined ? Prisma.empty : Prisma.sql`AND user_id = ${userId}`
  return db.$executeRaw`
    UPDATE plan_orders
    SET status = 'expired', decided_at = created_at + ${Prisma.raw(`interval '${ORDER_TTL_DAYS} days'`)}
    WHERE status = 'pending' AND created_at <= ${cutoff} ${byUser}`
}
```
- `getMyPlan`: dòng đầu sau `const now = new Date()` thêm `await expireStaleOrders(db, now, userId)`; trong object `pendingOrder` thêm `expiresAt: orderExpiresAt(pending.createdAt),` (sau `createdAt`).
- `createOrder`: trong transaction, ngay sau `pg_advisory_xact_lock`, thêm `await expireStaleOrders(tx, now, userId)` (trước khi đọc giá và huỷ đơn chờ cũ).
- `cancelOrder`: dòng đầu thêm `await expireStaleOrders(db, new Date(), userId)`.

Run: `pnpm test tests/integration/plan-orders.test.ts` → PASS toàn bộ. Ca 1 đỏ vì `decidedAt` lệch đúng 7 giờ → DB test không chạy TimeZone UTC: DỪNG, báo người điều phối (không tự cộng/trừ giờ).

- [ ] **Step 5: Integration phía admin (RED)**

Thêm vào cuối `tests/integration/admin.test.ts`:
```ts
describe("đơn quá hạn và admin.pendingCount (spec P7, J5)", () => {
  const DAY = 24 * 60 * 60 * 1000

  it("duyệt đơn quá 7 ngày (chưa ai đọc để expire) → BAD_REQUEST, gói không đổi; overview không có đơn, history có expired", async () => {
    const std = await getAuthedCaller("teacher_std")
    const { id } = await std.plan.createOrder({ plan: "plus", period: "year" })
    await db.planOrder.update({ where: { id }, data: { createdAt: new Date(Date.now() - 7 * DAY - 60_000) } })
    const admin = await getAuthedCaller("admin_test")

    await expect(admin.admin.approveOrder({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("standard")
    expect((await admin.admin.overview()).pendingOrders.map((o) => o.id)).not.toContain(id)
    expect((await admin.admin.orderHistory()).find((o) => o.id === id)?.status).toBe("expired")
  })

  it("đơn còn hạn vẫn duyệt được; overview có expiresAt", async () => {
    const std = await getAuthedCaller("teacher_std")
    const { id } = await std.plan.createOrder({ plan: "plus", period: "year" })
    const admin = await getAuthedCaller("admin_test")
    const row = (await admin.admin.overview()).pendingOrders.find((o) => o.id === id)!
    expect(new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime()).toBe(7 * DAY)
    await expect(admin.admin.approveOrder({ id })).resolves.toMatchObject({ creditDays: 0 })
  })

  it("pendingCount = số đơn chờ còn hạn (khớp overview); giáo viên gọi → FORBIDDEN", async () => {
    const std = await getAuthedCaller("teacher_std")
    await std.plan.createOrder({ plan: "plus", period: "year" })
    const admin = await getAuthedCaller("admin_test")
    const { count } = await admin.admin.pendingCount()
    expect(count).toBe((await admin.admin.overview()).pendingOrders.length)
    expect(count).toBeGreaterThanOrEqual(1)
    await expect(std.admin.pendingCount()).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
```
Run: `pnpm test tests/integration/admin.test.ts`
Expected: FAIL (approve thành công / `expiresAt` undefined / `pendingCount` không tồn tại).

- [ ] **Step 6: `plan-admin.service.ts` + router**

Import thêm `ORDER_TTL_DAYS, orderExpiresAt` (từ `@/lib/plans`, `addDays` đã có) và `expireStaleOrders` (từ `./plan.service`).
- `getAdminOverview`: sau `const now = new Date()` thêm `await expireStaleOrders(db, now)`; mỗi phần tử `pendingOrders` thêm `expiresAt: orderExpiresAt(o.createdAt),`.
- `getOrderHistory`: dòng đầu `await expireStaleOrders(db, new Date())`.
- Thêm:
```ts
// Nhẹ hơn overview (không tải user, không tính computeApproval): sidebar + tab bar gọi ở mọi trang admin (spec P J5).
export async function getPendingCount(db: PrismaClient): Promise<{ count: number }> {
  await expireStaleOrders(db, new Date())
  return { count: await db.planOrder.count({ where: { status: "pending" } }) }
}
```
- `approveOrder`: câu chốt đơn và nhánh lỗi thành:
```ts
    // Đơn quá hạn chưa kịp expire vẫn không duyệt được: điều kiện nằm ngay trong câu chốt (spec P7).
    const claimed = await tx.planOrder.updateMany({
      where: { id, status: "pending", createdAt: { gt: addDays(now, -ORDER_TTL_DAYS) } },
      data: { status: "approved", decidedBy: admin, decidedAt: now },
    })
    if (claimed.count === 0) {
      const cur = await tx.planOrder.findUnique({ where: { id }, select: { status: true } })
      if (cur?.status === "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Đơn đã quá 7 ngày chưa xác nhận nên đã hết hạn. Nếu khách đã chuyển khoản, hãy dùng Đặt gói",
        })
      }
      throw new TRPCError({ code: "CONFLICT", message: "Đơn không còn ở trạng thái chờ" })
    }
```
- `src/server/trpc/routers/admin.ts`: import `getPendingCount`; thêm `pendingCount: adminProcedure.query(({ ctx }) => getPendingCount(ctx.db)),` ngay sau `overview`.

Run: `pnpm test tests/integration/admin.test.ts` → PASS toàn bộ.
Run: `pnpm test tests/integration/plan-gating.test.ts` → PASS.

- [ ] **Step 7: UI hiển thị hết hạn + số đơn chờ (RED → GREEN)**

`tests/unit/components/AdminNav.test.tsx`: đổi mock thành
```ts
const pending = vi.hoisted(() => ({ data: undefined as undefined | { count: number } }))
vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { pendingCount: { useQuery: () => ({ data: pending.data }) } } },
}))
```
(`beforeEach` đặt `pending.data = undefined`; chỗ đang gán `overview.data = { pendingOrders: [{ id: 1 }, { id: 2 }], users: [] }` → `pending.data = { count: 2 }`.) Thêm ca tab bar:
```tsx
  it("tab Đơn chờ có số đơn chờ ở góc icon; 0 đơn → không có", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/history")
    pending.data = { count: 3 }
    const { unmount } = renderVi(<AdminTabBar />)
    const badge = screen.getByTestId("admin-tab-pending-count")
    expect(badge.textContent).toBe("3")
    expect(badge.className).toContain("bg-amber-100")
    expect(screen.getByRole("link", { name: /Đơn chờ/ }).contains(badge)).toBe(true)
    unmount()
    pending.data = { count: 0 }
    renderVi(<AdminTabBar />)
    expect(screen.queryByTestId("admin-tab-pending-count")).toBeNull()
  })
```
Ca cũ `"4 tab nhãn ngắn…"` so `textContent` từng link: vẫn đúng vì ca đó không có số (`pending.data` undefined).

Run: `pnpm test tests/unit/components/AdminNav.test.tsx` → FAIL (sidebar đọc `overview`, tab bar chưa có số).

Sửa:
- `AdminSidebar.tsx`: `const pendingCount = trpc.admin.pendingCount.useQuery().data?.count ?? 0` (ghi chú: `// Query nhẹ dùng chung với tab bar (spec P J5).`).
- `AdminTabBar.tsx`: import `trpc` từ `@/lib/trpc`; trong component `const pendingCount = trpc.admin.pendingCount.useQuery().data?.count ?? 0`; thay `<Icon className="size-5" />` bằng:
```tsx
                <span className="relative">
                  <Icon className="size-5" />
                  {item.href === "/admin/orders" && pendingCount > 0 && (
                    <span
                      data-testid="admin-tab-pending-count"
                      className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-amber-100 px-1 text-center text-[10px] font-semibold leading-4 text-amber-800"
                    >
                      {pendingCount}
                    </span>
                  )}
                </span>
```
- `src/app/(app)/plan/page.tsx` và `src/components/admin/AdminOrderHistory.tsx`: `STATUS_KEY` thêm `expired: "plan_status_expired",`.
- `PendingOrderCard.tsx`: import `dateTimeVn` từ `@/components/admin/admin-format`; ngay dưới `<p className="text-xs text-slate-500">{t("plan_pending_hint")}</p>` thêm
```tsx
      <p className="text-xs text-slate-500">{t("plan_order_expires").replace("{date}", dateTimeVn(order.expiresAt))}</p>
```
- `AdminPendingOrders.tsx`: import `dateTimeVn` từ `./admin-format`; cột `admin_col_created` đổi `cell` thành
```tsx
(o) => (
  <div className="whitespace-nowrap">
    <div>{dateOrDash(o.createdAt)}</div>
    <div className="text-xs text-slate-500">{t("admin_order_expires").replace("{date}", dateTimeVn(o.expiresAt))}</div>
  </div>
)
```
và thẻ mobile: dòng `<p className="text-xs text-slate-500">{dateOrDash(o.createdAt)}</p>` thành `<p className="text-xs text-slate-500">{dateOrDash(o.createdAt)} · {t("admin_order_expires").replace("{date}", dateTimeVn(o.expiresAt))}</p>`.
- i18n (vi / en): `plan_status_expired`: "Hết hạn" / "Expired"; `plan_order_expires`: "Tự hết hạn lúc {date} nếu chưa được xác nhận" / "Expires at {date} if not confirmed"; `admin_order_expires`: "Hết hạn lúc {date}" / "Expires at {date}".
- `tests/unit/components/PlanPurchaseDialog.test.tsx`: hàm `pendingOrder(...)` thêm `expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),` (thẻ gọi `dateTimeVn`). Các test khác có fixture `pendingOrder`/`pendingOrders` (grep `pendingOrder` trong `tests/unit`) → thêm `expiresAt` tương tự.

Run: `pnpm test tests/unit/components/AdminNav.test.tsx` rồi `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx` → PASS.

- [ ] **Step 8: E2E `/plan` đơn quá hạn**

Thêm cuối `tests/e2e/plan.spec.ts`:
```ts
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
```
Run (Bash):
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/plan.spec.ts tests/e2e/admin.spec.ts
```
Expected: tất cả passed.

- [ ] **Step 9: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` và `pnpm lint` → sạch.
```bash
git add src/lib/plans.ts src/server/services/plan.service.ts src/server/services/plan-admin.service.ts src/server/trpc/routers/admin.ts "src/app/(app)/plan/page.tsx" src/components/plan/PendingOrderCard.tsx src/components/admin/AdminOrderHistory.tsx src/components/admin/AdminPendingOrders.tsx src/components/admin/AdminSidebar.tsx src/components/admin/AdminTabBar.tsx src/language/vi.json src/language/en.json tests/unit/lib/plans.test.ts tests/integration/plan-orders.test.ts tests/integration/admin.test.ts tests/unit/components/AdminNav.test.tsx tests/unit/components/PlanPurchaseDialog.test.tsx tests/e2e/plan.spec.ts
git commit -m "fix(p): đơn gói chờ quá 7 ngày tự Hết hạn (không cron), chặn duyệt đơn quá hạn; admin.pendingCount cho sidebar + tab bar mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 6: Lỗi nhỏ J (popup mua gói, nhãn gói, phím mũi tên), L (dùng thử/giá), M (chép lịch), N (đổi mật khẩu, reset) (P8)

**Đọc trước:** Global Constraints; spec mục 3.8 (J1–J3, L1–L4, M1–M2, N1–N2), Q16–Q18; `src/components/plan/PlanPurchaseDialog.tsx`, `CurrentPlanBadge.tsx`; `src/components/providers/TRPCProvider.tsx` (`MutationCache` invalidate toàn bộ); `src/server/services/trial.service.ts`, `plan-price.service.ts` (`latestMonthPrice`), `src/lib/admin.ts` (`isAdminUsername`); `src/lib/copy-month.ts` (`CopyConflict`, `planMonthCopy` chỗ `count.past++`), `src/server/services/session-copy.service.ts` (`MAX_PREVIEW_CONFLICTS`), `src/components/sessions/CopyMonthDialog.tsx` (`PatternRow`, `slice(0, 20)`); `src/app/change-password/page.tsx`, `ForcedChangePassword.tsx`, `src/server/auth.config.ts` (`authorized`: redirect theo token); `src/components/admin/ResetPasswordDialog.tsx`; test: `tests/unit/components/PlanPurchaseDialog.test.tsx`, `CurrentPlanBadge.test.tsx`, `ResetPasswordDialog.test.tsx`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/lib/copy-month.test.ts`, `tests/integration/trial-days.test.ts`, `tests/integration/plan-prices.test.ts`, `tests/integration/session-copy-month.test.ts`.

**Files:**
- Create: `src/lib/radio-group-keys.ts`, `src/app/change-password/PasswordAlreadyChanged.tsx`
- Modify: `src/components/plan/PlanPurchaseDialog.tsx`, `src/components/plan/CurrentPlanBadge.tsx`
- Modify: `src/server/services/trial.service.ts`, `src/server/services/plan-price.service.ts`
- Modify: `src/lib/copy-month.ts`, `src/server/services/session-copy.service.ts`
- Modify: `src/app/change-password/page.tsx`, `src/components/admin/ResetPasswordDialog.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/lib/radio-group-keys.test.tsx`, `tests/unit/components/PasswordAlreadyChanged.test.tsx`
- Test (Sửa): `tests/unit/components/PlanPurchaseDialog.test.tsx`, `CurrentPlanBadge.test.tsx`, `ResetPasswordDialog.test.tsx`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/lib/copy-month.test.ts`, `tests/integration/trial-days.test.ts`, `tests/integration/plan-prices.test.ts`

**Interfaces:**
- Consumes: `plan.me.pendingOrder.expiresAt` (Task 5, fixture test đã có).
- Produces:
  - `src/lib/radio-group-keys.ts`: `handleRadioGroupKeyDown(e: React.KeyboardEvent<HTMLElement>): void`.
  - `src/lib/copy-month.ts`: `capConflictsPerPattern(conflicts: CopyConflict[], max: number): CopyConflict[]`.
  - `src/app/change-password/PasswordAlreadyChanged.tsx`: `PasswordAlreadyChanged()` (client component).
  - Key i18n: `plan_order_load_error`, `password_already_changed_title`, `password_already_changed_desc`, `relogin`; đổi `copy_skip_past`.

- [ ] **Step 1: Xác nhận DB test** — lệnh như Task 3 Step 1.

- [ ] **Step 2: J3 phím mũi tên — helper (RED → GREEN)**

Tạo `tests/unit/lib/radio-group-keys.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { handleRadioGroupKeyDown } from "@/lib/radio-group-keys"

function Group({ disabled }: { disabled?: string }) {
  const [v, setV] = useState("a")
  return (
    <div role="radiogroup" aria-label="nhóm" onKeyDown={handleRadioGroupKeyDown}>
      {["a", "b", "c"].map((x) => (
        <button key={x} type="button" role="radio" aria-checked={v === x} tabIndex={v === x ? 0 : -1} disabled={x === disabled} onClick={() => setV(x)}>
          {x}
        </button>
      ))}
    </div>
  )
}
const radio = (name: string) => screen.getByRole("radio", { name })
function press(key: string) {
  fireEvent.keyDown(document.activeElement!, { key })
}

describe("handleRadioGroupKeyDown (spec P J3)", () => {
  it("ArrowRight/ArrowDown → radio kế tiếp được chọn + focus; vòng về đầu", () => {
    render(<Group />)
    radio("a").focus()
    press("ArrowRight")
    expect(radio("b").getAttribute("aria-checked")).toBe("true")
    expect(document.activeElement).toBe(radio("b"))
    press("ArrowDown")
    press("ArrowDown")
    expect(radio("a").getAttribute("aria-checked")).toBe("true")
  })
  it("ArrowLeft từ đầu → cuối; Home/End", () => {
    render(<Group />)
    radio("a").focus()
    press("ArrowLeft")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
    press("Home")
    expect(radio("a").getAttribute("aria-checked")).toBe("true")
    press("End")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
  })
  it("bỏ qua radio disabled; phím khác không làm gì", () => {
    render(<Group disabled="b" />)
    radio("a").focus()
    press("ArrowRight")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
    press("x")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
  })
  it("roving tabindex: chỉ radio đang chọn có tabIndex 0", () => {
    render(<Group />)
    expect([radio("a"), radio("b"), radio("c")].map((r) => r.tabIndex)).toEqual([0, -1, -1])
  })
})
```
Run: `pnpm test tests/unit/lib/radio-group-keys.test.tsx` → FAIL (không resolve import).

Tạo `src/lib/radio-group-keys.ts`:
```ts
import type { KeyboardEvent } from "react"

// Mẫu WAI-ARIA radio: mũi tên chuyển focus và chọn luôn radio kế tiếp (bỏ radio disabled, quay vòng). Gắn vào div[role=radiogroup].
export function handleRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'))
  if (radios.length === 0) return
  const last = radios.length - 1
  const cur = radios.indexOf(document.activeElement as HTMLElement)
  let next: number
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = cur >= last ? 0 : cur + 1
      break
    case "ArrowLeft":
    case "ArrowUp":
      next = cur <= 0 ? last : cur - 1
      break
    case "Home":
      next = 0
      break
    case "End":
      next = last
      break
    default:
      return
  }
  e.preventDefault()
  radios[next].focus()
  radios[next].click()
}
```
Run lại → PASS 4 test.

- [ ] **Step 3: J1 + J3 trong `PlanPurchaseDialog` (RED → GREEN)**

`tests/unit/components/PlanPurchaseDialog.test.tsx`:
- Mock tRPC thêm `plan.me.useQuery` đọc trạng thái hoãn:
```ts
const meQ = vi.hoisted(() => ({ isFetching: true, refetch: vi.fn() }))
// trong object plan của vi.mock("@/lib/trpc"):
      me: { useQuery: () => meQ },
```
  `beforeEach` đặt `meQ.isFetching = true; meQ.refetch.mockReset()`.
- Thêm ca:
```tsx
  it("tạo đơn xong mà refetch plan.me lỗi/không có đơn mới → hiện lỗi + mã SM + Thử lại (spec P J1)", () => {
    renderDialog({ me: makeMe({ pendingOrder: pendingOrder(1, "OLDOLD") }) })
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onSuccess!({ id: 5, code: "NEWNEW", bonusMonths: 0 }))
    expect(screen.queryByTestId("purchase-load-error")).toBeNull() // còn đang fetch → Skeleton
    meQ.isFetching = false
    act(() => mut.createOpts!.onSuccess!({ id: 5, code: "NEWNEW", bonusMonths: 0 }))
    const box = screen.getByTestId("purchase-load-error")
    expect(box.textContent).toContain("Đã tạo đơn nhưng chưa tải được thông tin chuyển khoản.")
    expect(box.textContent).toContain("SM NEWNEW")
    const retry = screen.getByRole("button", { name: "Thử lại" })
    expect(retry.className).toContain("h-11")
    fireEvent.click(retry)
    expect(meQ.refetch).toHaveBeenCalled()
  })

  it("radiogroup kỳ hạn: mũi tên phải chọn kỳ kế tiếp, roving tabindex (spec P J3)", () => {
    renderDialog()
    const year = screen.getByTestId("purchase-period-year")
    expect(year.tabIndex).toBe(0)
    expect(screen.getByTestId("purchase-period-month").tabIndex).toBe(-1)
    year.focus()
    fireEvent.keyDown(year, { key: "ArrowRight" })
    expect(screen.getByTestId("purchase-period-2year").getAttribute("aria-checked")).toBe("true")
  })
```
  (Gọi `onSuccess` lần 2 chỉ để ép render lại sau khi đổi `meQ`; nếu `renderDialog` trả `rerender` thì dùng `rerender(props)` thay cho lần gọi thứ 2 và ghi Ruling. Thứ tự `PERIODS` đọc trong `src/lib/plans.ts`: nếu `year` không đứng trước `2year` → đổi kỳ vọng cho đúng phần tử kế tiếp trong DOM.)

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx` → FAIL 2 ca mới.

Sửa `PlanPurchaseDialog.tsx`:
- Import `handleRadioGroupKeyDown` từ `@/lib/radio-group-keys`.
- State: thay `const [createdId, setCreatedId] = useState<number | null>(null)` bằng `const [created, setCreated] = useState<{ id: number; code: string } | null>(null)`; `onSuccess: (res) => { toast.success(t("plan_order_created")); setCreated({ id: res.id, code: res.code }) }`.
- Thêm `const meQuery = trpc.plan.me.useQuery()` (ghi chú: `// Cùng key với usePlan của trang: chỉ đọc trạng thái refetch, không thêm request.`).
- `const createdOrder = created !== null && me.pendingOrder?.id === created.id ? me.pendingOrder : null`; điều kiện `createdId !== null` → `created !== null`.
- Nhánh `createdOrder ? … : <Skeleton …/>` thành:
```tsx
            {createdOrder ? (
              <PendingOrderCard order={createdOrder} paymentReady={me.paymentReady} onCancelled={() => onOpenChange(false)} />
            ) : meQuery.isFetching ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              // Refetch lỗi hoặc không thấy đơn vừa tạo: vẫn đưa mã để chuyển khoản được (spec P J1).
              <div data-testid="purchase-load-error" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p>{t("plan_order_load_error")}</p>
                <p className="font-medium">
                  {t("notice_transfer_content")}: SM {created.code}
                </p>
                <Button type="button" variant="outline" className="h-11 bg-white md:h-10" onClick={() => void meQuery.refetch()}>
                  {t("retry")}
                </Button>
              </div>
            )}
```
- 2 thẻ `div role="radiogroup"` thêm `onKeyDown={handleRadioGroupKeyDown}`; mỗi `<button role="radio">` thêm `tabIndex={selected ? 0 : -1}`.
- i18n `plan_order_load_error`: vi "Đã tạo đơn nhưng chưa tải được thông tin chuyển khoản." / en "Order created, but the transfer details could not be loaded."

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx` → PASS toàn bộ (ca Skeleton cũ PASS vì `meQ.isFetching` mặc định `true`).

- [ ] **Step 4: J2 `CurrentPlanBadge` (RED → GREEN)**

`tests/unit/components/CurrentPlanBadge.test.tsx`, ca `"Pro dùng thử…"` thêm:
```ts
    expect(badge.getAttribute("role")).toBe("img")
    expect(screen.getByRole("img", { name: "Pro dùng thử" })).toBe(badge)
```
và ca Standard (`"… không aria-label"`) thêm `expect(badge.getAttribute("role")).toBeNull()`. (Import `screen` nếu file chưa có.)
Run → FAIL. Sửa `CurrentPlanBadge.tsx`: trên `<span data-testid="current-plan-badge"` thêm `role={trialLabel ? "img" : undefined}` và thay ghi chú Q16 thành `// Q16: sidebar hẹp → icon đồng hồ; role img để aria-label "Pro dùng thử" được đọc (span trơn bị bỏ qua).` Run → PASS.

- [ ] **Step 5: L1–L3 (RED → GREEN)**

`tests/integration/trial-days.test.ts`, describe `"đặt riêng từng tài khoản (T3)"` thêm (đọc đầu file để dùng đúng helper tạo user/caller admin; `ADMIN_USERNAMES = "admin_test"` đã đặt ở `beforeEach`):
```ts
  it("đặt dùng thử cho tài khoản admin → FORBIDDEN, không ghi lịch sử (spec P L1)", async () => {
    const admin = await getAuthedCaller("admin_test")
    const adminUser = await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })
    const before = await db.trialDayChange.count({ where: { userId: adminUser.id } })
    await expect(admin.admin.setUserTrial({ userId: adminUser.id, days: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(await db.trialDayChange.count({ where: { userId: adminUser.id } })).toBe(before)
  })

  it("2 lần đặt cùng lúc → lịch sử nối tiếp đúng (previousDays lần sau = days lần trước) (spec P L2)", async () => {
    const admin = await getAuthedCaller("admin_test")
    const std = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    await Promise.all([
      admin.admin.setUserTrial({ userId: std.id, days: 30 }),
      admin.admin.setUserTrial({ userId: std.id, days: 90 }),
    ])
    const rows = await db.trialDayChange.findMany({ where: { userId: std.id }, orderBy: { id: "desc" }, take: 2 })
    expect(rows[0].previousDays).toBe(rows[1].days)
  })
```
describe `"số ngày dùng thử mặc định (T1, T2)"` thêm:
```ts
  it("hiện hành = dòng id lớn nhất dù createdAt sớm hơn (spec P L3)", async () => {
    const row = await db.trialDayChange.create({
      data: { userId: null, days: 45, previousDays: 60, changedBy: "test-p-l3", createdAt: new Date("2000-01-01T00:00:00Z") },
    })
    try {
      expect(await getDefaultTrialDays(db)).toBe(45)
    } finally {
      await db.trialDayChange.delete({ where: { id: row.id } })
    }
  })
```
(import `getDefaultTrialDays` từ `@/server/services/trial.service` nếu chưa có.)
`tests/integration/plan-prices.test.ts`, describe `"plan-price.service (đọc)"` thêm:
```ts
  it("giá hiện hành = dòng id lớn nhất dù createdAt sớm hơn (spec P L3)", async () => {
    await db.planPriceChange.create({
      data: { plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "test-p-l3", createdAt: new Date("2000-01-01T00:00:00Z") },
    })
    expect((await getMonthlyPrices(db)).plus).toBe(59000)
  })
```
(`reset` của file đã xoá dòng `changedBy` khác `migration`; `getMonthlyPrices` import từ `@/server/services/plan-price.service`.)

Run: `pnpm test tests/integration/trial-days.test.ts` → FAIL ca L1 (không FORBIDDEN) và L3; ca L2 có thể PASS (Điều chỉnh ý 3).
Run: `pnpm test tests/integration/plan-prices.test.ts` → FAIL ca L3 (vẫn 49.000).

Sửa:
- `plan-price.service.ts` `latestMonthPrice`: `orderBy: [{ createdAt: "desc" }, { id: "desc" }]` → `orderBy: { id: "desc" }` + ghi chú `// id cấp lúc INSERT sau khóa → đúng thứ commit; createdAt = giờ bắt đầu transaction nên có thể sớm hơn dòng đã commit trước (spec P L3).`
- `trial.service.ts` `getDefaultTrialDays`: tương tự `orderBy: { id: "desc" }` (ghi chú ngắn "như latestMonthPrice"). Hàm lịch sử giữ nguyên.
- `trial.service.ts` `setUserTrialDays`: import `isAdminUsername` từ `@/lib/admin`; đầu transaction:
```ts
    // Cùng khóa theo user với tạo/duyệt đơn: 2 lần đặt cùng lúc không ghi previousDays sai (spec P L2).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(input.userId)})`
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { username: true, createdAt: true, trialEndsAt: true },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
    if (isAdminUsername(user.username)) throw new TRPCError({ code: "FORBIDDEN", message: "Tài khoản admin không dùng gói" })
```
Run 2 file → PASS toàn bộ.

- [ ] **Step 6: M1 + M2 (RED → GREEN)**

`tests/unit/lib/copy-month.test.ts` thêm (import `capConflictsPerPattern`):
```ts
describe("capConflictsPerPattern (spec P M1)", () => {
  it("cắt theo từng mẫu, giữ thứ tự; mẫu sau không bị mẫu trước chiếm hết", () => {
    const mk = (patternKey: string, i: number) => ({ patternKey, date: `2030-02-${String(i + 1).padStart(2, "0")}`, conflict: "x" })
    const input = [...Array.from({ length: 25 }, (_, i) => mk("A", i)), ...Array.from({ length: 3 }, (_, i) => mk("B", i))]
    const out = capConflictsPerPattern(input, 20)
    expect(out.filter((c) => c.patternKey === "A")).toHaveLength(20)
    expect(out.filter((c) => c.patternKey === "B")).toHaveLength(3)
    expect(out[0]).toEqual(input[0])
  })
})
```
Run → FAIL. Thêm vào `src/lib/copy-month.ts` (dưới kiểu `CopyConflict`):
```ts
// Xem trước chỉ cần vài xung đột mỗi mẫu; cắt chung sẽ làm mẫu sắp sau mất hết danh sách chi tiết (spec P M1).
export function capConflictsPerPattern(conflicts: CopyConflict[], max: number): CopyConflict[] {
  const seen = new Map<string, number>()
  return conflicts.filter((c) => {
    const n = seen.get(c.patternKey) ?? 0
    seen.set(c.patternKey, n + 1)
    return n < max
  })
}
```
`session-copy.service.ts`: thay `const MAX_PREVIEW_CONFLICTS = 50` bằng `const MAX_PREVIEW_CONFLICTS_PER_PATTERN = 20 // khớp slice(0, 20) của PatternRow`; `conflicts: plan.conflicts.slice(0, MAX_PREVIEW_CONFLICTS)` → `conflicts: capConflictsPerPattern(plan.conflicts, MAX_PREVIEW_CONFLICTS_PER_PATTERN)` (import thêm từ `@/lib/copy-month`).
M2 i18n: `copy_skip_past` vi → `"{count} ca rơi vào ngày đã qua, bỏ qua"`, en → `"{count} sessions on past days, skipped"`. Grep `ngày đã qua, bỏ qua` và `past days, skipped` trong `tests/` → cập nhật chữ kỳ vọng (vd `tests/unit/components/CopyMonthDialog.test.tsx`, `tests/e2e/copy-month.spec.ts`).

Run: `pnpm test tests/unit/lib/copy-month.test.ts`, `pnpm test tests/unit/components/CopyMonthDialog.test.tsx`, `pnpm test tests/integration/session-copy-month.test.ts` → PASS.

- [ ] **Step 7: N1 trang "đã đổi mật khẩu" (RED → GREEN)**

`tests/unit/layout/admin-redirect.test.ts`: thêm mock `vi.mock("@/app/change-password/PasswordAlreadyChanged", () => ({ PasswordAlreadyChanged: () => null }))` cạnh mock `ForcedChangePassword`; import 2 component đã mock để so `type`; thêm helper:
```ts
function hasType(node: unknown, type: unknown): boolean {
  if (!node || typeof node !== "object") return false
  if (Array.isArray(node)) return node.some((n) => hasType(n, type))
  const el = node as { type?: unknown; props?: { children?: unknown } }
  return el.type === type || hasType(el.props?.children, type)
}
```
Sửa ca `"/change-password: chưa đăng nhập → /login?expired=1; không có cờ → /dashboard; có cờ → hiện form"`: phần "không có cờ" thành
```ts
    // Cờ DB đã tắt nhưng cookie cũ còn cờ → middleware đẩy về đây; redirect đi sẽ thành vòng (spec P N1).
    const el = await ChangePasswordPage()
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(hasType(el, PasswordAlreadyChanged)).toBe(true)
    expect(hasType(el, ForcedChangePassword)).toBe(false)
```
và phần "có cờ" thêm `expect(hasType(el2, ForcedChangePassword)).toBe(true)` (đặt tên biến theo code thật; `mocks.redirect.mockClear()` giữa các lần gọi nếu cần). Đổi tên ca cho khớp.
Tạo `tests/unit/components/PasswordAlreadyChanged.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { signOut } from "next-auth/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }))

import { PasswordAlreadyChanged } from "@/app/change-password/PasswordAlreadyChanged"

describe("PasswordAlreadyChanged (spec P N1)", () => {
  it("tiêu đề + mô tả; 1 nút Đăng nhập lại ≥44px gọi signOut về /login", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <PasswordAlreadyChanged />
      </LanguageProvider>
    )
    expect(screen.getByRole("heading", { name: "Mật khẩu đã được cập nhật" })).toBeTruthy()
    expect(screen.getByText("Đăng nhập lại để tiếp tục dùng ứng dụng.")).toBeTruthy()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    const btn = screen.getByRole("button", { name: "Đăng nhập lại" })
    expect(btn.className).toContain("h-11")
    fireEvent.click(btn)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" })
  })
})
```
Run 2 file → FAIL.

Tạo `src/app/change-password/PasswordAlreadyChanged.tsx`:
```tsx
"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Cookie cũ còn cờ bắt đổi mật khẩu nên middleware luôn đưa về đây; chỉ đăng nhập lại mới làm mới cookie.
export function PasswordAlreadyChanged() {
  const { t } = useTranslation()
  return (
    <div data-testid="password-already-changed" className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">{t("password_already_changed_title")}</h1>
        <p className="text-sm text-slate-500">{t("password_already_changed_desc")}</p>
      </div>
      <Button type="button" className="h-11 w-full md:h-10" onClick={() => signOut({ callbackUrl: "/login" })}>
        {t("relogin")}
      </Button>
    </div>
  )
}
```
`src/app/change-password/page.tsx`: bỏ dòng `if (session.user.mustChangePassword !== true) redirect("/dashboard")`; import `PasswordAlreadyChanged`; trong `CardContent`:
```tsx
          {/* Cờ DB đã tắt (vd sửa tay) mà cookie còn cờ: không redirect để khỏi vòng với middleware (spec P N1). */}
          {session.user.mustChangePassword === true ? <ForcedChangePassword /> : <PasswordAlreadyChanged />}
```
i18n (vi / en): `password_already_changed_title` "Mật khẩu đã được cập nhật" / "Your password has been updated"; `password_already_changed_desc` "Đăng nhập lại để tiếp tục dùng ứng dụng." / "Sign in again to continue."; `relogin` "Đăng nhập lại" / "Sign in again" (grep trước: key `relogin` đã có thì dùng lại, không tạo trùng).

Run 2 file → PASS. Run `pnpm test tests/unit/next15-contract.test.ts` → PASS.

- [ ] **Step 8: N2 ResetPasswordDialog chặn đóng khi đang chạy (RED → GREEN)**

`tests/unit/components/ResetPasswordDialog.test.tsx`: `mut` thêm `isPending: false`; mock trả `isPending: mut.isPending`; `beforeEach` đặt `mut.isPending = false`. Thêm:
```tsx
  it("đang reset → Esc không đóng; xong (không pending) → Esc đóng (spec P N2)", () => {
    mut.isPending = true
    const onClose = renderDialog()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("không pending → Esc gọi onClose", () => {
    const onClose = renderDialog()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
```
Run → FAIL ca 1. Sửa `ResetPasswordDialog.tsx`: `<AlertDialog open onOpenChange={(open) => !open && !mut.isPending && onClose()}>` + ghi chú `{/* Đóng lúc đang chạy là mất mật khẩu tạm vừa sinh (không có đường xem lại). */}`. Run → PASS.

- [ ] **Step 9: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` và `pnpm lint` → sạch.
```bash
git add src/lib/radio-group-keys.ts src/components/plan/PlanPurchaseDialog.tsx src/components/plan/CurrentPlanBadge.tsx src/server/services/trial.service.ts src/server/services/plan-price.service.ts src/lib/copy-month.ts src/server/services/session-copy.service.ts src/app/change-password/page.tsx src/app/change-password/PasswordAlreadyChanged.tsx src/components/admin/ResetPasswordDialog.tsx src/language/vi.json src/language/en.json tests/unit/lib/radio-group-keys.test.tsx tests/unit/components/PasswordAlreadyChanged.test.tsx tests/unit/components/PlanPurchaseDialog.test.tsx tests/unit/components/CurrentPlanBadge.test.tsx tests/unit/components/ResetPasswordDialog.test.tsx tests/unit/layout/admin-redirect.test.ts tests/unit/lib/copy-month.test.ts tests/integration/trial-days.test.ts tests/integration/plan-prices.test.ts
git status --short   # file test khác đã sửa chữ copy_skip_past (Step 6) → add thêm đúng file đó
git commit -m "fix(p): lỗi nhỏ J/L/M/N (popup mua gói hết Skeleton mãi, nhãn gói role img, phím mũi tên radio, chặn dùng thử cho admin + khóa, giá/dùng thử hiện hành theo id, xung đột cắt theo mẫu, trang đã đổi mật khẩu không vòng redirect, reset không đóng khi đang chạy)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 7: Màn `/admin/accounts` — cột Hành động (menu), cột không xuống dòng, phân trang (P9)

**Đọc trước:** Global Constraints; spec mục 3.9, Q19–Q20; `src/components/admin/AdminAccounts.tsx`; `src/components/students/StudentList.tsx` (`actionsMenu`: mẫu menu Hành động + dialog ngoài menu); `src/components/layout/AppHeader.tsx` (menu avatar: icon trái + chữ); `src/components/common/ResponsiveList.tsx` (`Column.className` áp cho cả `th` và `td`; bảng `hidden md:block`, thẻ `md:hidden`); `src/hooks/usePagination.ts`; `src/components/ui/data-table-pagination.tsx` (`fixed` đáy, nút sr-only "Trang sau"); `src/components/admin/AdminLayout.tsx` (padding `main`); `SetPlanDialog.tsx`, `TrialDaysDialog.tsx`, `ResetPasswordDialog.tsx` (props `{ user, onClose }`); `tests/unit/components/AppHeader.test.tsx` (cách mở Radix menu trong jsdom: `keyDown Enter`); `tests/e2e/admin-trial.spec.ts`, `tests/e2e/admin-reset-password.spec.ts`, `tests/e2e/admin.spec.ts`.

**Files:**
- Modify: `src/components/admin/AdminAccounts.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json` (`admin_col_actions`)
- Test (Mới): `tests/unit/components/AdminAccounts.test.tsx`, `tests/e2e/admin-accounts.spec.ts`
- Test (Sửa): `tests/e2e/admin-trial.spec.ts`, `tests/e2e/admin-reset-password.spec.ts`

**Interfaces:**
- Consumes: `admin.overview.users` (không đổi); `usePagination<T>(data: T[] | undefined, initialPageSize?: number)` → `{ currentPage, setCurrentPage, pageSize, setPageSize, paginatedData, totalItems, totalPages }`.
- Produces: nút `data-testid="admin-user-actions"`, tên truy cập `"Menu hành động <username>"` (key `actions` + tên đăng nhập); menu item "Đặt gói" / "Đặt dùng thử" / "Reset mật khẩu"; key `admin_col_actions`.

- [ ] **Step 1: Xác nhận DB test** — lệnh như Task 3 Step 1.

- [ ] **Step 2: Unit (RED)**

Tạo `tests/unit/components/AdminAccounts.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

type U = {
  id: number; username: string; fullName: string | null; createdAt: string; lastLoginAt: string | null
  activeStudents: number; plan: "standard" | "plus" | "pro"; source: "free" | "trial" | "paid"
  expiresAt: string | null; trialEndsAt: string | null; isAdmin: boolean
}
const state = vi.hoisted(() => ({ users: [] as U[] }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      overview: {
        useQuery: () => ({ data: { users: state.users, pendingOrders: [] }, isPending: false, isError: false, refetch: vi.fn() }),
      },
    },
  },
}))
vi.mock("@/components/admin/SetPlanDialog", () => ({ SetPlanDialog: ({ user }: { user: U }) => <div data-testid="set-plan-dialog">{user.username}</div> }))
vi.mock("@/components/admin/TrialDaysDialog", () => ({ TrialDaysDialog: ({ user }: { user: U }) => <div data-testid="trial-dialog">{user.username}</div> }))
vi.mock("@/components/admin/ResetPasswordDialog", () => ({ ResetPasswordDialog: ({ user }: { user: U }) => <div data-testid="reset-dialog">{user.username}</div> }))

import { AdminAccounts } from "@/components/admin/AdminAccounts"

function user(id: number, over: Partial<U> = {}): U {
  return {
    id, username: `gv${id}`, fullName: `Giáo viên ${id}`, createdAt: "2026-09-01T03:00:00.000Z", lastLoginAt: null,
    activeStudents: 3, plan: "standard", source: "free", expiresAt: null, trialEndsAt: null, isAdmin: false, ...over,
  }
}
function renderPage() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminAccounts />
    </LanguageProvider>
  )
}
// Bảng và thẻ đều có trong DOM (jsdom không áp CSS md:) → luôn tìm trong bảng.
const table = () => screen.getByRole("table")
function openMenu(username: string) {
  fireEvent.keyDown(within(table()).getByRole("button", { name: `Menu hành động ${username}` }), { key: "Enter" })
}

beforeEach(() => {
  state.users = [user(1), user(2, { username: "admin_test", isAdmin: true })]
})

describe("AdminAccounts — cột Hành động, cột gọn, phân trang (spec P9)", () => {
  it("có cột Hành động; không còn nút rời Đặt gói/Đặt dùng thử/Reset mật khẩu", () => {
    renderPage()
    expect(within(table()).getByRole("columnheader", { name: "Hành động" })).toBeTruthy()
    for (const name of ["Đặt gói", "Đặt dùng thử", "Reset mật khẩu"]) {
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })

  it("giáo viên: menu đủ 3 mục đúng thứ tự, mỗi mục có icon", async () => {
    renderPage()
    openMenu("gv1")
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Đặt gói", "Đặt dùng thử", "Reset mật khẩu"])
    for (const i of items) {
      expect(i.querySelector("svg")).not.toBeNull()
      expect(i.className).toContain("min-h-11")
    }
  })

  it("tài khoản admin: chỉ Đặt gói", async () => {
    renderPage()
    openMenu("admin_test")
    expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Đặt gói"])
  })

  it.each([
    ["Đặt gói", "set-plan-dialog"],
    ["Đặt dùng thử", "trial-dialog"],
    ["Reset mật khẩu", "reset-dialog"],
  ])("chọn %s → mở đúng dialog cho đúng tài khoản", async (item, testId) => {
    renderPage()
    openMenu("gv1")
    fireEvent.click(await screen.findByRole("menuitem", { name: item }))
    expect((await screen.findByTestId(testId)).textContent).toBe("gv1")
  })

  it("nút Hành động ≥44px mobile; tiêu đề và ô ngày/gói không xuống dòng", () => {
    renderPage()
    expect(within(table()).getByRole("button", { name: "Menu hành động gv1" }).className).toContain("size-11")
    for (const name of ["Tên đăng nhập", "Đăng nhập cuối", "HS đang học", "Gói", "Hành động"]) {
      expect(within(table()).getByRole("columnheader", { name }).className).toContain("whitespace-nowrap")
    }
    expect(within(table()).getByText("Standard · Miễn phí", { selector: "td" }).className).toContain("whitespace-nowrap")
  })

  it("25 tài khoản → trang 1 có 20 dòng, Trang sau → 5 dòng", () => {
    state.users = Array.from({ length: 25 }, (_, i) => user(i + 1))
    renderPage()
    const rows = () => within(table()).getAllByRole("row").length - 1
    expect(rows()).toBe(20)
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }))
    expect(rows()).toBe(5)
  })
})
```
(Nhãn gói thật do `PLAN_LABEL` + `SOURCE_KEY` sinh; nếu chữ ô khác "Standard · Miễn phí" → dùng đúng chữ thật, ghi Ruling.)

Run: `pnpm test tests/unit/components/AdminAccounts.test.tsx`
Expected: FAIL (chưa có cột Hành động, còn nút rời, không phân trang).

- [ ] **Step 3: Sửa `AdminAccounts.tsx`**

Viết lại file:
```tsx
"use client"

import { useState } from "react"
import { BadgeCheck, Clock, KeyRound, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePagination } from "@/hooks/usePagination"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PLAN_LABEL, formatValidUntil } from "@/lib/plans"
import { SetPlanDialog } from "./SetPlanDialog"
import { TrialDaysDialog } from "./TrialDaysDialog"
import { ResetPasswordDialog } from "./ResetPasswordDialog"
import { SOURCE_KEY, dateOrDash } from "./admin-format"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

const NOWRAP = "whitespace-nowrap"
const ITEM = "min-h-11 md:min-h-0"

export function AdminAccounts() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [setPlanFor, setSetPlanFor] = useState<UserRow | null>(null)
  const [trialFor, setTrialFor] = useState<UserRow | null>(null)
  const [resetFor, setResetFor] = useState<UserRow | null>(null)
  // Vài chục tài khoản, overview đã trả đủ → phân trang phía client (spec P Q19).
  const { paginatedData, currentPage, setCurrentPage, pageSize, setPageSize, totalItems, totalPages } = usePagination(
    query.data?.users,
    20
  )

  const planCell = (u: UserRow) => `${PLAN_LABEL[u.plan]} · ${t(SOURCE_KEY[u.source])}`
  const expiry = (u: UserRow) => (u.expiresAt ? formatValidUntil(new Date(u.expiresAt)) : "-")
  // Item chỉ đặt state, dialog render ngoài menu (cùng cách StudentList): menu đóng hẳn rồi dialog mới mở.
  const actionsMenu = (u: UserRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="admin-user-actions"
          aria-label={`${t("actions")} ${u.username}`}
          className="size-11 md:size-9"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className={ITEM} onSelect={() => setSetPlanFor(u)}>
          <BadgeCheck className="mr-2 size-4" />
          {t("admin_set_plan")}
        </DropdownMenuItem>
        {/* Admin không dùng gói/không reset được mật khẩu admin (spec L mục 15, spec N R3). */}
        {!u.isAdmin && (
          <>
            <DropdownMenuItem className={ITEM} onSelect={() => setTrialFor(u)}>
              <Clock className="mr-2 size-4" />
              {t("admin_set_trial")}
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} onSelect={() => setResetFor(u)}>
              <KeyRound className="mr-2 size-4" />
              {t("admin_reset_password")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const columns: Column<UserRow>[] = [
    { header: t("username"), cell: (u) => <span className="font-medium">{u.username}</span>, className: NOWRAP },
    { header: t("full_name"), cell: (u) => u.fullName ?? "-", className: "min-w-[8rem]" },
    { header: t("admin_col_created"), cell: (u) => dateOrDash(u.createdAt), className: NOWRAP },
    { header: t("admin_col_last_login"), cell: (u) => dateOrDash(u.lastLoginAt), className: NOWRAP },
    { header: t("admin_col_students"), cell: (u) => u.activeStudents, className: `${NOWRAP} text-right` },
    { header: t("admin_col_plan"), cell: planCell, className: NOWRAP },
    { header: t("admin_col_expiry"), cell: expiry, className: NOWRAP },
    { header: t("admin_col_actions"), cell: actionsMenu, className: `w-14 ${NOWRAP} text-right` },
  ]

  return (
    // pb-14: thanh phân trang fixed ở đáy không che dòng/thẻ cuối.
    <div className="space-y-6 pb-14">
      <PageHeader title={t("admin_accounts_plans")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={paginatedData}
        getKey={(u) => u.id}
        columns={columns}
        emptyText="-"
        renderCard={(u) => (
          <div data-testid="admin-user-card" className="space-y-2 rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{u.username}</p>
                <p className="truncate text-sm text-slate-500">{u.fullName ?? "-"}</p>
              </div>
              <div className="-mr-2 -mt-2 shrink-0">{actionsMenu(u)}</div>
            </div>
            <p className="text-sm font-medium text-primary">{planCell(u)}</p>
            <p className="text-xs text-slate-500">
              {t("admin_col_expiry")}: {expiry(u)} · {t("admin_col_students")}: {u.activeStudents} · {t("admin_col_last_login")}: {dateOrDash(u.lastLoginAt)}
            </p>
          </div>
        )}
      />

      {totalItems > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          totalItems={totalItems}
        />
      )}

      {setPlanFor && <SetPlanDialog key={setPlanFor.id} user={setPlanFor} onClose={() => setSetPlanFor(null)} />}
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
      {resetFor && <ResetPasswordDialog key={resetFor.id} user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  )
}
```
i18n (vi / en): `admin_col_actions`: "Hành động" / "Actions".

Run: `pnpm test tests/unit/components/AdminAccounts.test.tsx` → PASS. Ca "chọn … mở đúng dialog" đỏ vì Radix không gọi `onSelect` khi `fireEvent.click` → thử `fireEvent.keyDown(item, { key: "Enter" })`; vẫn đỏ → DỪNG, báo (không đổi sang mở dialog trong menu).

- [ ] **Step 4: Sửa e2e admin đang bấm nút rời**

Thêm helper vào đầu `tests/e2e/admin-trial.spec.ts` và `tests/e2e/admin-reset-password.spec.ts` (import thêm `type Locator`):
```ts
// Từ spec P9 các thao tác tài khoản nằm trong menu Hành động của từng dòng/thẻ.
async function openUserMenu(scope: Locator, username: string) {
  await scope.getByRole('button', { name: `Menu hành động ${username}` }).click();
  return scope.page().getByRole('menu');
}
```
- `admin-trial.spec.ts`:
  - Chỗ khẳng định dòng `admin_test` không có nút "Đặt dùng thử" (desktop, `getByRole('row')`): `const m = await openUserMenu(admin.getByRole('row').filter({ hasText: 'admin_test' }), 'admin_test'); await expect(m.getByRole('menuitem', { name: 'Đặt dùng thử' })).toHaveCount(0); await admin.keyboard.press('Escape');`
  - Chỗ bấm "Đặt dùng thử" của `teacher_std`: `await (await openUserMenu(admin.getByRole('row').filter({ hasText: 'teacher_std' }), 'teacher_std')).getByRole('menuitem', { name: 'Đặt dùng thử' }).click();`
  - Ca 390px: thẻ `admin_test` → mở menu, không có mục "Đặt dùng thử", Escape; nút cần đo ≥44px là nút `Menu hành động teacher_std` (đo cả rộng); rồi mở menu → mục "Đặt dùng thử" cao ≥44px → bấm. Đổi tên test cho khớp.
- `admin-reset-password.spec.ts`: 2 chỗ `row.getByRole('button', { name: 'Reset mật khẩu' }).click()` → `(await openUserMenu(row, TARGET)).getByRole('menuitem', { name: 'Reset mật khẩu' }).click()`; ca 390px: `btn` = nút `Menu hành động ${TARGET}` (≥44px, nằm trong thẻ), thẻ admin: mở menu → không có mục "Reset mật khẩu", Escape; rồi mở menu thẻ `TARGET` → bấm mục "Reset mật khẩu" → phần đo dialog giữ nguyên. Đổi tên test cho khớp.
- `admin.spec.ts` chỉ đọc chữ thẻ → không sửa; vẫn phải xanh.

- [ ] **Step 5: E2E mới `tests/e2e/admin-accounts.spec.ts`**

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function openAccounts(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await page.goto('/admin/accounts');
  await expect(page.getByRole('heading', { level: 1, name: 'Tài khoản & gói' })).toBeVisible();
  return page;
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('1280px: cột Hành động gọn, tiêu đề 1 dòng, bảng không tràn; menu → dialog → Hủy không kẹt trang (spec P9)', async ({ browser }) => {
  const page = await openAccounts(browser, DESKTOP);
  // DB test chỉ có seed + vài user e2e; nhiều hơn 20 thì dòng mục tiêu có thể sang trang 2.
  expect(await page.getByRole('row').count()).toBeLessThanOrEqual(21);

  const ref = (await page.getByRole('columnheader', { name: 'Gói', exact: true }).boundingBox())!.height;
  for (const name of ['Tên đăng nhập', 'Đăng nhập cuối', 'HS đang học', 'Hành động']) {
    expect((await page.getByRole('columnheader', { name }).boundingBox())!.height, name).toBeLessThanOrEqual(ref + 1);
  }
  const tableOverflow = await page.locator('table').evaluate((t) => t.scrollWidth - (t.parentElement?.clientWidth ?? t.scrollWidth));
  expect(tableOverflow).toBeLessThanOrEqual(0);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  const row = page.getByRole('row').filter({ hasText: 'teacher_std' });
  await row.getByRole('button', { name: 'Menu hành động teacher_std' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Đặt gói', 'Đặt dùng thử', 'Reset mật khẩu']);
  await page.getByRole('menuitem', { name: 'Đặt gói' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('teacher_std');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.body.style.pointerEvents)).not.toBe('none');

  await page.getByRole('row').filter({ hasText: 'admin_test' }).getByRole('button', { name: 'Menu hành động admin_test' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Đặt gói']);
  await page.keyboard.press('Escape');
  await page.context().close();
});

test('390px: nút Hành động ≥44px ở góc thẻ, mục menu ≥44px, Reset mật khẩu → Hủy, không tràn ngang (spec P9)', async ({ browser }) => {
  const page = await openAccounts(browser, MOBILE);
  const card = page.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' });
  const btn = card.getByRole('button', { name: 'Menu hành động teacher_std' });
  const b = (await btn.boundingBox())!;
  const c = (await card.boundingBox())!;
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);
  expect(b.y - c.y).toBeLessThan(24);

  await btn.click();
  for (const item of await page.getByRole('menuitem').all()) {
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('menuitem', { name: 'Reset mật khẩu' }).click();
  const dlg = page.getByRole('alertdialog');
  await dlg.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  expect((await dlg.getByRole('button', { name: 'Hủy', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dlg).toBeHidden();
  expect(await page.evaluate(() => document.body.style.pointerEvents)).not.toBe('none');

  // Thẻ cuối không bị thanh phân trang che.
  await page.locator('main').evaluate((m) => m.scrollTo(0, m.scrollHeight));
  const last = (await page.getByTestId('admin-user-card').last().boundingBox())!;
  const next = (await page.getByRole('button', { name: 'Trang sau' }).boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(next.y);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});
```
(SetPlanDialog không có nút "Hủy" đúng chữ → đọc file, dùng nút đóng thật, ghi Ruling.)

Run (Bash):
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-accounts.spec.ts tests/e2e/admin-trial.spec.ts tests/e2e/admin-reset-password.spec.ts tests/e2e/admin.spec.ts
```
Expected: tất cả passed. Đỏ ở `pointerEvents === 'none'` → DỪNG, ghi lại bước tái hiện, báo người điều phối (Review Focus 4; không tự thêm `modal={false}` khi chưa báo).

- [ ] **Step 6: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` và `pnpm lint` → sạch.
```bash
git add src/components/admin/AdminAccounts.tsx src/language/vi.json src/language/en.json tests/unit/components/AdminAccounts.test.tsx tests/e2e/admin-accounts.spec.ts tests/e2e/admin-trial.spec.ts tests/e2e/admin-reset-password.spec.ts
git commit -m "fix(p): màn Tài khoản admin có cột Hành động (menu Đặt gói/Đặt dùng thử/Reset mật khẩu), cột không xuống dòng, phân trang 20/trang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 8: Nút Xuất Excel màn Lịch chỉ icon; "Thêm học sinh" dạng split button có mục "Nhập Excel" (P10, P11)

**Đọc trước:** Global Constraints; spec mục 3.10, 3.11, Q22–Q25; `src/components/reports/ExportExcelButton.tsx`; `src/components/calendar/CalendarToolbar.tsx` (khối hàng nút cuối, ghi chú bố cục mobile của M); `src/app/(app)/reports/page.tsx` (chỗ dùng thứ 2, KHÔNG đổi); `src/components/students/StudentList.tsx` (`PageHeader.actions`, `importGate`, `atLimit`, `openLimit`); `src/components/students/ImportStudentsDialog.tsx` (`ImportStudentsButton`, hàm `ImportStudentsDialog`); `src/hooks/useFeatureGate.ts`; `src/components/plan/LockBadge.tsx` (`plan: PaidPlan`); `src/components/layout/AppHeader.tsx` (kiểu menu); `tests/unit/components/ImportStudentsDialog.test.tsx`; `tests/e2e/students-import.spec.ts`, `tests/e2e/plan-locks.spec.ts` (đoạn "Học sinh: nhập Excel khóa Pro"), `tests/e2e/copy-month.spec.ts` (ca mobile 390px), `tests/e2e/layout-desktop.spec.ts`, `tests/e2e/students.spec.ts`.

**Files:**
- Modify: `src/components/reports/ExportExcelButton.tsx`, `src/components/calendar/CalendarToolbar.tsx`
- Create: `src/components/students/AddStudentSplitButton.tsx`
- Modify: `src/components/students/StudentList.tsx`, `src/components/students/ImportStudentsDialog.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json` (`more_options`)
- Test (Mới): `tests/unit/components/ExportExcelButton.test.tsx`, `tests/unit/components/AddStudentSplitButton.test.tsx`
- Test (Sửa): `tests/unit/components/ImportStudentsDialog.test.tsx`, `tests/e2e/students-import.spec.ts`, `tests/e2e/plan-locks.spec.ts`, `tests/e2e/copy-month.spec.ts`, `tests/e2e/layout-desktop.spec.ts`, `tests/e2e/students.spec.ts`

**Interfaces:**
- Consumes: `useFeatureGate(feature)` → `{ locked, allowed, requiredPlan, openUpgrade, guard }`; `minPlanForStudents(total): PaidPlan`.
- Produces:
  - `ExportExcelButton` prop mới `iconOnly?: boolean`.
  - `AddStudentSplitButton({ onAdd, onImport, addLockPlan }: { onAdd: () => void; onImport: () => void; addLockPlan: PaidPlan | null })`; nút mũi tên `data-testid="add-student-more"`, tên "Mở thêm lựa chọn".
  - `ImportStudentsDialog({ onClose })` được export; `ImportStudentsButton` bị xoá.

- [ ] **Step 1: Xác nhận DB test** — lệnh như Task 3 Step 1. Kiểm nơi dùng: `grep -rn "ExportExcelButton\|ImportStudentsButton" src tests` → ghi lại (kỳ vọng: `ExportExcelButton` ở `CalendarToolbar.tsx` + `reports/page.tsx`; `ImportStudentsButton` ở `StudentList.tsx` + `ImportStudentsDialog.test.tsx`).

- [ ] **Step 2: Unit `ExportExcelButton` (RED → GREEN)**

Tạo `tests/unit/components/ExportExcelButton.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }))
vi.mock("@/hooks/useExcelExport", () => ({
  useExcelExport: () => ({
    isExporting: false,
    exportMonthlySchedule: vi.fn(),
    exportStudentSchedule: vi.fn(),
    exportGradeReport: vi.fn(),
    exportAttendanceSummary: vi.fn(),
  }),
}))
vi.mock("@/hooks/useCalendar", () => ({ useCalendar: () => ({ year: 2026, month: 9 }) }))
vi.mock("@/hooks/useFilters", () => ({ useFilters: () => ({ selectedGrade: null, selectedStudentId: null }) }))
vi.mock("@/lib/trpc", () => ({ trpc: { tuition: { getMonthlyStatus: { useQuery: () => ({ data: undefined }) } } } }))

import { ExportExcelButton } from "@/components/reports/ExportExcelButton"

function renderBtn(iconOnly?: boolean) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <ExportExcelButton sessions={[]} iconOnly={iconOnly} className="size-11 md:size-10" />
    </LanguageProvider>
  )
}

describe("ExportExcelButton (spec P10)", () => {
  it("iconOnly: tên truy cập + tooltip Xuất Excel, không có chữ hiển thị", () => {
    renderBtn(true)
    const btn = screen.getByRole("button", { name: "Xuất Excel" })
    expect(btn.getAttribute("title")).toBe("Xuất Excel")
    expect(btn.textContent).toBe("")
    expect(btn.className).toContain("size-11")
    expect(btn.querySelector("svg")).not.toBeNull()
  })
  it("mặc định (màn Báo cáo): vẫn có chữ Xuất Excel", () => {
    renderBtn()
    expect(screen.getByRole("button", { name: "Xuất Excel" }).textContent).toBe("Xuất Excel")
  })
})
```
Run → FAIL ca 1 (có chữ, không `title`). Sửa `ExportExcelButton.tsx`: props thêm `iconOnly?: boolean` (mặc định `false`, import `cn` từ `@/lib/utils`); `Button` thành:
```tsx
        <Button
          variant="outline"
          size={iconOnly ? "icon" : "sm"}
          disabled={isExporting}
          className={className}
          // Màn Lịch chỉ hiện icon (spec P10): giữ tên cho trình đọc màn hình + tooltip.
          aria-label={iconOnly ? t("export_excel") : undefined}
          title={iconOnly ? t("export_excel") : undefined}
        >
          {isExporting ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", !iconOnly && "mr-2")} />
          ) : (
            <FileSpreadsheet className={cn("h-4 w-4 text-green-600", !iconOnly && "mr-2")} />
          )}
          {!iconOnly && t("export_excel")}
        </Button>
```
Run → PASS.

- [ ] **Step 3: Bố cục toolbar Lịch**

`CalendarToolbar.tsx`, khối hàng nút cuối:
- Ghi chú bố cục → `{/* Dưới md: hàng 1 Lịch lặp | Chép lịch tháng chia đôi, hàng 2 nút Xuất Excel vuông + Tạo ca dạy giãn hết; từ md 1 hàng như cũ. */}`
- `div` bọc: `grid grid-cols-2 gap-2 …` → `flex flex-wrap gap-2 border-t border-slate-100 pt-1 md:flex-wrap md:items-center md:justify-end md:border-t-0 md:pt-0` (giữ nguyên phần `md:` cũ).
- `ExportExcelButton`: thêm `iconOnly`, `className="order-3 size-11 shrink-0 md:order-1 md:size-10"`.
- Nút Lịch lặp: `w-full` → `min-w-0 basis-[calc(50%-0.25rem)] grow md:basis-auto md:grow-0` (giữ các class khác, `md:w-auto` giữ).
- Nút Chép lịch tháng: tương tự Lịch lặp.
- Nút Tạo ca dạy: `w-full` → `min-w-0 flex-1 md:flex-none` (giữ `md:ml-2 md:w-auto` và class khác).

E2E `tests/e2e/copy-month.spec.ts` ca `'mobile 390px: nút toolbar ≥44px không chồng nhau…'`: thêm
```ts
  const exportBtn = (await page.getByRole('button', { name: 'Xuất Excel' }).boundingBox())!;
  expect(exportBtn.height).toBeGreaterThanOrEqual(44);
  expect(exportBtn.width).toBeGreaterThanOrEqual(44);
  for (const b of [copyBtn, bulkBtn, createBtn]) expect(intersects(exportBtn, b)).toBe(false);
  // Hàng 1 chia đôi; hàng 2: icon + Tạo ca dạy cùng hàng.
  expect(Math.abs(copyBtn.y - bulkBtn.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(exportBtn.y - createBtn.y)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
```
`tests/e2e/layout-desktop.spec.ts` thêm (theo `test.describe`/`beforeEach` đăng nhập sẵn có của file):
```ts
  test('màn Lịch: nút Xuất Excel chỉ icon, cao bằng nút Lịch lặp (spec P10)', async ({ page }) => {
    await page.goto('/calendar');
    const exp = page.getByRole('button', { name: 'Xuất Excel' });
    await expect(exp).toHaveAttribute('title', 'Xuất Excel');
    await expect(exp).toHaveText('');
    const h = (await exp.boundingBox())!.height;
    const bulk = (await page.getByRole('button', { name: 'Lịch lặp' }).boundingBox())!.height;
    expect(Math.abs(h - bulk)).toBeLessThanOrEqual(1);
  });
```

- [ ] **Step 4: Unit `AddStudentSplitButton` (RED)**

Tạo `tests/unit/components/AddStudentSplitButton.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const gate = vi.hoisted(() => ({ locked: false, allowed: true, openUpgrade: vi.fn() }))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({ ...gate, requiredPlan: "pro", guard: (fn: () => void) => fn }),
}))

import { AddStudentSplitButton } from "@/components/students/AddStudentSplitButton"

function renderBtn(addLockPlan: "plus" | "pro" | null = null) {
  const onAdd = vi.fn()
  const onImport = vi.fn()
  render(
    <LanguageProvider forcedLanguage="vi">
      <AddStudentSplitButton onAdd={onAdd} onImport={onImport} addLockPlan={addLockPlan} />
    </LanguageProvider>
  )
  return { onAdd, onImport }
}
const openMenu = () => fireEvent.keyDown(screen.getByRole("button", { name: "Mở thêm lựa chọn" }), { key: "Enter" })

beforeEach(() => {
  gate.locked = false
  gate.allowed = true
  gate.openUpgrade.mockReset()
})

describe("AddStudentSplitButton (spec P11)", () => {
  it("phần chính 'Thêm học sinh' gọi onAdd; mũi tên có tên truy cập, ≥44px mobile", () => {
    const { onAdd } = renderBtn()
    fireEvent.click(screen.getByRole("button", { name: "Thêm học sinh" }))
    expect(onAdd).toHaveBeenCalled()
    const more = screen.getByRole("button", { name: "Mở thêm lựa chọn" })
    expect(more.className).toContain("h-11")
    expect(more.className).toContain("w-11")
  })

  it("menu chỉ 1 mục chữ Nhập Excel, không icon; gói Pro chọn → onImport", async () => {
    const { onImport } = renderBtn()
    openMenu()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Nhập Excel"])
    expect(items[0].querySelector("svg")).toBeNull()
    fireEvent.click(items[0])
    expect(onImport).toHaveBeenCalled()
    expect(gate.openUpgrade).not.toHaveBeenCalled()
  })

  it("Standard/Plus (locked): mục có ổ khóa, chọn → popup nâng cấp, không mở nhập", async () => {
    gate.locked = true
    gate.allowed = false
    const { onImport } = renderBtn()
    openMenu()
    const item = await screen.findByRole("menuitem", { name: /Nhập Excel/ })
    expect(item.querySelector('[data-testid="lock-badge"]')).not.toBeNull()
    fireEvent.click(item)
    expect(gate.openUpgrade).toHaveBeenCalled()
    expect(onImport).not.toHaveBeenCalled()
  })

  it("chưa biết gói: mục tạm khóa", async () => {
    gate.locked = false
    gate.allowed = false
    renderBtn()
    openMenu()
    expect((await screen.findByRole("menuitem", { name: /Nhập Excel/ })).getAttribute("aria-disabled")).toBe("true")
  })

  it("hết hạn mức HS: phần chính có ổ khóa gói", () => {
    renderBtn("plus")
    expect(screen.getByRole("button", { name: /Thêm học sinh/ }).querySelector('[data-testid="lock-badge"]')).not.toBeNull()
  })
})
```
Run: `pnpm test tests/unit/components/AddStudentSplitButton.test.tsx` → FAIL (không resolve import).

- [ ] **Step 5: Tạo `AddStudentSplitButton.tsx`, nối vào `StudentList`, export dialog**

`src/components/students/AddStudentSplitButton.tsx`:
```tsx
"use client"

import { ChevronDown, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
import type { PaidPlan } from "@/lib/plans"

type Props = { onAdd: () => void; onImport: () => void; addLockPlan: PaidPlan | null }

export function AddStudentSplitButton({ onAdd, onImport, addLockPlan }: Props) {
  const { t } = useTranslation()
  const importGate = useFeatureGate("studentImport")

  return (
    <div className="flex">
      <Button onClick={onAdd} className="h-11 rounded-r-none md:h-10">
        <UserPlus className="mr-2 size-4" />
        {t("add_student")}
        {addLockPlan && <LockBadge plan={addLockPlan} className="ml-1.5" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("more_options")}
            data-testid="add-student-more"
            className="h-11 w-11 rounded-l-none border-l border-primary-foreground/30 px-0 md:h-10 md:w-9"
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Chưa biết gói: khóa tạm, không mở dialog nhập cũng không popup nâng cấp nhầm (luật cũ của nút Nhập Excel). */}
          <DropdownMenuItem
            className="min-h-11 md:min-h-0"
            disabled={!importGate.allowed && !importGate.locked}
            onSelect={() => (importGate.allowed ? onImport() : importGate.openUpgrade())}
          >
            {t("import_excel")}
            {importGate.locked && <LockBadge plan={importGate.requiredPlan} className="ml-auto pl-2" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```
(Nếu `FEATURE_PLAN.studentImport` có kiểu không phải `PaidPlan` → theo kiểu thật của `LockBadge`, ghi Ruling. Ổ khóa bên trong `LockBadge` là `svg` `aria-hidden` → ca "không icon" chỉ kiểm khi chưa khóa, đúng như test.)

`ImportStudentsDialog.tsx`: `function ImportStudentsDialog(` → `export function ImportStudentsDialog(`; xoá toàn bộ `export function ImportStudentsButton() {…}` và import chỉ nó dùng (vd `FileSpreadsheet` nếu không còn chỗ nào dùng — kiểm bằng grep trong file).

`StudentList.tsx`:
- Xoá `const importGate = useFeatureGate("studentImport")`, khối `{!importGate.allowed ? (<Button …>) : (<ImportStudentsButton />)}`, import `ImportStudentsButton`, `FileSpreadsheet`, `UserPlus` (nếu không còn dùng), và nút "Thêm học sinh" cũ.
- Thêm `const [importOpen, setImportOpen] = useState(false)`; import `ImportStudentsDialog` từ `./ImportStudentsDialog`, `AddStudentSplitButton` từ `./AddStudentSplitButton`.
- `actions` thành:
```tsx
          <>
            <UpgradeAllClassesButton />
            <AddStudentSplitButton
              onAdd={() => (atLimit ? openLimit() : setFormState({ open: true, mode: "create" }))}
              onImport={() => setImportOpen(true)}
              addLockPlan={atLimit && me ? minPlanForStudents(me.activeStudents + 1) : null}
            />
          </>
```
- Cạnh các dialog cuối file: `{importOpen && <ImportStudentsDialog onClose={() => setImportOpen(false)} />}`.
- `useFeatureGate`/`LockBadge` còn dùng cho `linkGate` → giữ import.
- i18n (vi / en): `more_options`: "Mở thêm lựa chọn" / "More options".

`tests/unit/components/ImportStudentsDialog.test.tsx`: import `ImportStudentsDialog` thay `ImportStudentsButton`; render `<ImportStudentsDialog onClose={() => {}} />`; bỏ dòng `fireEvent.click(screen.getByLabelText("Nhập Excel"))`.

Run: `pnpm test tests/unit/components/AddStudentSplitButton.test.tsx` → PASS.
Run: `pnpm test tests/unit/components/ImportStudentsDialog.test.tsx` → PASS.
Run: `pnpm test tests/unit/components/ExportExcelButton.test.tsx` → PASS.

- [ ] **Step 6: Sửa e2e màn Học sinh**

- `tests/e2e/students-import.spec.ts`: 2 chỗ `await page.getByRole('button', { name: 'Nhập Excel' }).click();` →
```ts
    await page.getByTestId('add-student-more').click();
    await page.getByRole('menuitem', { name: 'Nhập Excel' }).click();
```
- `tests/e2e/plan-locks.spec.ts` đoạn "Học sinh: nhập Excel khóa Pro":
```ts
  await page.goto('/students');
  await page.getByTestId('add-student-more').click();
  const importItem = page.getByRole('menuitem', { name: /Nhập Excel/ });
  await expect(importItem.getByTestId('lock-badge')).toBeVisible();
  await importItem.click();
  await expect(upgrade(page)).toContainText(PRO_TEXT);
  await closeUpgrade(page);
```
- `tests/e2e/students.spec.ts` thêm ca 390px (theo cách đăng nhập sẵn có của file; ẩn `nextjs-portal`):
```ts
  test('390px: split button Thêm học sinh 2 phần ≥44px, không chồng, mũi tên mở đúng 1 mục Nhập Excel (spec P11)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/students');
    const main = (await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).boundingBox())!;
    const more = (await page.getByTestId('add-student-more').boundingBox())!;
    for (const b of [main, more]) expect(b.height).toBeGreaterThanOrEqual(44);
    expect(more.width).toBeGreaterThanOrEqual(44);
    expect(main.x + main.width).toBeLessThanOrEqual(more.x + 1);
    expect(await page.getByRole('button', { name: 'Nhập Excel' }).count()).toBe(0);
    await page.getByTestId('add-student-more').click();
    await expect(page.getByRole('menuitem')).toHaveText([/Nhập Excel/]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
  });
```
(Người dùng `teacher` là Pro → mục không có ổ khóa. Nút chính có `LockBadge` khi hết hạn mức → dùng `exact: true` chỉ khi không khóa; nếu tài khoản test đã chạm hạn mức thì đổi sang regex, ghi Ruling.)

Run (Bash):
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/students.spec.ts tests/e2e/students-import.spec.ts tests/e2e/plan-locks.spec.ts tests/e2e/copy-month.spec.ts tests/e2e/layout-desktop.spec.ts tests/e2e/mobile.spec.ts tests/e2e/calendar.spec.ts
```
Expected: tất cả passed. Ca cũ nào tìm nút `'Thêm học sinh'` bằng `getByRole` không `exact` mà nay khớp 2 nút → không xảy ra (tên nút mũi tên là "Mở thêm lựa chọn"); nếu có → thêm `exact: true`, ghi Ruling.

- [ ] **Step 7: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` và `pnpm lint` → sạch.
```bash
git add src/components/reports/ExportExcelButton.tsx src/components/calendar/CalendarToolbar.tsx src/components/students/AddStudentSplitButton.tsx src/components/students/StudentList.tsx src/components/students/ImportStudentsDialog.tsx src/language/vi.json src/language/en.json tests/unit/components/ExportExcelButton.test.tsx tests/unit/components/AddStudentSplitButton.test.tsx tests/unit/components/ImportStudentsDialog.test.tsx tests/e2e/students-import.spec.ts tests/e2e/plan-locks.spec.ts tests/e2e/copy-month.spec.ts tests/e2e/layout-desktop.spec.ts tests/e2e/students.spec.ts
git commit -m "fix(p): màn Lịch nút Xuất Excel chỉ icon (có tên + tooltip, cân hàng nút mobile); màn Học sinh gộp Nhập Excel vào split button Thêm học sinh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---
### Task 9: Nâng version 0.4.1, kiểm chứng cuối, danh sách kiểm tra tay (không merge, không push)

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" (toàn bộ); Review Focus; spec mục 2, 6, 9, 10; `git log --oneline main..HEAD` (1 commit docs + 7 commit Task 2–8).

**Files:**
- Modify: `package.json` (chỉ dòng `"version"`)
- Chỉ sửa file của Task 2–8 nếu kiểm chứng phát hiện lỗi (mỗi sửa: test tái hiện → sửa → commit riêng `fix(p): …`, ghi vào báo cáo).

**Interfaces:**
- Consumes: toàn bộ Task 2–8.
- Produces: `package.json` `"version": "0.4.1"`; báo cáo cho người điều phối.

- [ ] **Step 1: Xác nhận DB test** — lệnh như Task 3 Step 1.

- [ ] **Step 2: Nâng version (patch, không ép đăng nhập lại)**

Run (Bash): `grep '"version"' package.json` → Expected `"0.4.0"`. Khác → nâng patch kế tiếp của bản đó, ghi báo cáo.
Sửa đúng 1 dòng: `"version": "0.4.0",` → `"version": "0.4.1",` (Edit, giữ xuống dòng). Epoch `0.4` không đổi (`epochOf` chỉ lấy `major.minor`) → không ai bị đăng xuất.
```bash
git add package.json
git commit -m "chore(p): nâng version 0.4.1 (sửa lỗi, epoch 0.4 giữ nguyên, không ép đăng nhập lại)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 3: Quét sót**

Run (Bash):
```bash
grep -n "todayUTC\|nowMs" src/server/services/student.service.ts
grep -rn "ImportStudentsButton\|MAX_PREVIEW_CONFLICTS\b" src tests
grep -rn "admin\.overview" src/components/admin/AdminSidebar.tsx src/components/admin/AdminTabBar.tsx
grep -rn "indigo-\|violet-\|purple-" src
git diff main..HEAD -- src/language | grep -P "^\+.*[—–]"
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(JSON.stringify([a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k))]))"
git diff --stat main..HEAD -- prisma/ tests/setup.ts
grep -rn "suppressHydrationWarning" src
```
Expected: lệnh 1–5 không in gì; lệnh 6 in `[[],[]]`; lệnh 7 không in gì (không migration, không đụng `tests/setup.ts`); lệnh 8 không in gì hoặc chỉ chỗ đã có trước P (so `git grep` trên `main`).

- [ ] **Step 4: Toàn bộ unit + integration**

Run: `pnpm test` (~10–15 phút, không chạy song song lệnh test khác)
Expected: toàn bộ PASS, gồm `session-time`, `next-config-build-time`, `theme-legacy-colors`, `SessionCard`, `DashboardAlerts`, `plans`, `AdminNav`, `PlanPurchaseDialog`, `radio-group-keys`, `CurrentPlanBadge`, `ResetPasswordDialog`, `PasswordAlreadyChanged`, `admin-redirect`, `copy-month`, `AdminAccounts`, `ExportExcelButton`, `AddStudentSplitButton`, `ImportStudentsDialog`, `next15-contract`, `dashboard-alerts`, `student-upgrade`, `student-delete-schedule-sync`, `plan-orders`, `admin`, `trial-days`, `plan-prices`, `session-copy-month`, `tuition*`, `backup`.

- [ ] **Step 5: E2E toàn bộ**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test
```
Expected: tất cả passed (`upgrade-class` có thể `skipped` nếu DB test đã nâng lớp năm nay — chấp nhận). File nào fail: chạy lại riêng file đó 1 lần để loại chập chờn; vẫn fail → sửa theo mục Files, ghi báo cáo.

- [ ] **Step 6: Lint + tsc + build (DB test) + kiểm giờ build (P2)**

Run (Bash):
```bash
pnpm lint
pnpm exec tsc --noEmit
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  pnpm exec next build
)
grep -rhoE '[0-9]{2}/[0-9]{2}/20[0-9]{2} [0-9]{2}:[0-9]{2}' .next/server .next/static | sort | uniq -c
```
Expected: lint/tsc sạch; build thành công. Lệnh grep cuối in **đúng 1 dòng** (1 giá trị giờ build dùng chung server + client) — nhiều giá trị → P2 chưa sửa đúng: DỪNG, ghi các giá trị + file chứa, báo người điều phối. (Nếu có chuỗi ngày giờ khác không phải giờ build, vd dữ liệu tĩnh, ghi rõ nguồn trong báo cáo.) KHÔNG chạy `pnpm build` (có `prisma migrate deploy` lên `.env` production).

- [ ] **Step 7: Báo cáo cho người điều phối (không merge, không push)**

Gồm: version trước/sau; kết quả Step 3–6 (kèm output grep giờ build); `git log --oneline main..HEAD`; mọi Ruling/chỗ lệch plan của Task 1–9 (kèm lý do); danh sách kiểm tra tay Step 8; và nhắc:
- P **không migration**; vẫn nên tạo backup Neon theo thói quen trước merge (Neon console → "Branch from current", tên kiểu `backup-before-P-2026-xx-xx`).
- Đơn chờ đang quá 7 ngày trên prod sẽ chuyển "Hết hạn" ngay lần đầu có người mở `/plan` hoặc trang admin.
- Dữ liệu lên lớp năm 2026 đã chạy trước P **không** được sửa lùi (khối cũ/HS lớp 12 có thể còn trong ca tương lai).

- [ ] **Step 8: Kiểm tra tay cho người dùng (sau khi merge + Vercel deploy; agent KHÔNG làm)**

1. **Log build Vercel:** không có dòng `Applying migration` mới (P không migration); không có `Resetting`/`rolled back`.
2. **#418:** mở `/students` (và `/dashboard`, `/admin/orders` bằng tài khoản admin) với DevTools Console → không còn "Minified React error #418". Sidebar hiện `v0.4.1` + giờ build. Không bị đăng xuất khi lên bản mới.
3. **`qa_test` (id 4, người dùng tự đăng nhập):**
   - Tổng quan → "Cần chú ý": nếu có HS đã nghỉ còn nợ → dòng có nhãn xám "Đã nghỉ", bấm mở đúng HS ở Học phí.
   - Lịch: ca đã huỷ ở mọi cấp (tiểu học/THCS/THPT) nền đỏ nhạt; nút Xuất Excel chỉ icon, di chuột thấy "Xuất Excel", bấm mở menu xuất; xuất "Lịch tháng" → tiêu đề file Excel màu teal (không còn tím).
   - Tài khoản → Sao lưu dữ liệu: file Excel hàng tiêu đề nền xanh ngọc nhạt.
   - Học sinh: không còn nút "Nhập Excel" rời; bấm mũi tên cạnh "Thêm học sinh" → 1 mục "Nhập Excel"; (Standard/Plus: có ổ khóa, bấm mở popup gói Pro).
   - Điện thoại 390px: hàng nút màn Lịch (Lịch lặp | Chép lịch tháng; icon Excel + Tạo ca dạy) không tràn, không chồng.
4. **Admin:** `/admin/accounts` → cột "Hành động", bấm ⋯ ở dòng `qa_test` → 3 mục có icon; mở "Đặt dùng thử" rồi Hủy → trang vẫn bấm được; dòng admin chỉ "Đặt gói"; có thanh phân trang; mobile có số đơn chờ trên tab "Đơn chờ" (nếu có đơn). Không đặt gói/dùng thử/reset trên tài khoản giáo viên thật để thử.
5. **Lên lớp:** chỉ tự chạy khi đăng nhập từ tháng 7 năm sau (hoặc bấm tay "Nâng lớp hàng loạt" — KHÔNG bấm trên prod để thử). Kiểm lịch các tháng tới năm nay: gỡ tay HS lớp 12 đã nghỉ nếu còn trong ca tương lai (dữ liệu trước P).
6. **Rollback:** không có migration → revert commit merge là đủ; đơn đã chuyển `expired` vẫn hiện chữ "expired" thô ở bản cũ (không gây lỗi), có thể để nguyên.

---

## Self-Review (người viết plan đã chạy)

- **Phủ spec:** P1 (T3: `onlyStudentIds`, `isActive`, nhãn, e2e), P2 (T4: `APP_BUILD_TIMESTAMP` + unit; T9 grep `.next`), P3 (T4: 4 hằng + test hex, loại trừ màu môn Q6), P4 (T4: `!isCancelled`), P5 (T2: `upgradeAllClasses` + ca 0 HS giữ Q8, manual + auto, multi-tenant, `timeout 15000`), P6 (T2: `session-time.ts`, `findUnfinishedLinks`, sửa 2 test chập chờn), P7 (T5: `ORDER_TTL_DAYS`, `expireStaleOrders` ở mọi đường, `approveOrder` chặn, hiển thị `/plan` + history + pending card, e2e), P8 J1–J3 (T6), J4–J5 (T5 `admin.pendingCount`), L1–L4 (T6; L4 quyết định không làm), M1–M2 (T6), N1–N2 (T6), P9 (T7: menu, cột, phân trang client 20, sửa e2e admin), P10–P11 (T8: `iconOnly`, bố cục flex, split button, export dialog + xoá orphan, sửa e2e). Version 0.4.1 (T9). Lỗi server tiếng Anh: ngoài phạm vi (U4).
- **Placeholder:** không có TBD/TODO; các bước có nhánh điều kiện (resetModules không nạp lại, Radix `onSelect` trong jsdom, TimeZone DB test, nút Hủy SetPlanDialog, tài khoản chạm hạn mức) đều có cách xử lý hoặc điểm DỪNG cụ thể.
- **Nhất quán tên:** `vnToday`, `hasSessionEnded`, `findUnfinishedLinks`, `onlyStudentIds`, `alert-debt-inactive`, `APP_BUILD_TIMESTAMP`, `ORDER_TTL_DAYS`, `orderExpiresAt`, `expireStaleOrders`, `getPendingCount`/`admin.pendingCount`, `admin-tab-pending-count`, `expiresAt`, `handleRadioGroupKeyDown`, `purchase-load-error`, `capConflictsPerPattern`, `MAX_PREVIEW_CONFLICTS_PER_PATTERN`, `PasswordAlreadyChanged`, `admin-user-actions`, `admin_col_actions`, `iconOnly`, `AddStudentSplitButton`, `add-student-more`, `more_options` dùng giống nhau ở mọi task và khớp spec.
- **Review Focus:** 5 dòng, mỗi dòng có test ở task sở hữu (T3 integration HS nghỉ; T2 unit + integration 18:00/01:00 VN; T5 integration duyệt đơn quá hạn; T7 e2e `pointerEvents`; T6 unit popup lỗi refetch).
