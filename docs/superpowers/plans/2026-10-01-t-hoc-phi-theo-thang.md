# T — Học phí theo tháng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi học sinh chọn thu "Theo buổi" hoặc "Trọn tháng"; trọn tháng thu đủ mức tháng khi tháng có ≥ 1 ca; lịch sử cách thu giữ đúng các tháng cũ; báo cáo/phiếu/link phụ huynh đúng số.

**Architecture:** Bảng lịch sử `student_billing_changes` + cột hiện tại trên `students`. Một module thuần `src/lib/billing.ts` (resolve cách thu theo tháng, tính phí tháng, doanh thu) dùng chung cho tuition.service (tháng hiện tại + đi lịch sử nợ) và report.service. UI chỉ đọc `billingMode`/`monthlyFee` từ DTO.

**Tech Stack:** Next.js 15, tRPC v11 (không transformer), Prisma 5.22 + Postgres, Vitest, Playwright, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-10-01-t-hoc-phi-theo-thang-design.md`

## Global Constraints

- Nhánh `feat/t-hoc-phi-theo-thang` từ `main` **sau khi S đã merge**. Spec + plan đã có trên `main` → không commit docs.
- Version khi xong: `0.9.0` (epoch `0.9` → mọi người đăng nhập lại 1 lần).
- Migration mới `add_student_billing` — chỉ thêm bảng/cột, không destructive. Tạo bằng `pnpm exec prisma migrate dev --name add_student_billing --create-only` với env `.env.test` (xem `docs/coding-rule.md` §6.1), kiểm SQL rồi `migrate deploy` lên DB test.
- `.env` = PRODUCTION. **CẤM** `db:reset`, `migrate reset`, `db push`, `pnpm build`, `pnpm dev`, `git stash`. Build kiểm bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` của `.env.test`.
- Mọi test tạo HS/lưu ngân hàng truyền `consent: CONSENT_ACCEPTED` (O1).
- Tên HS mã hoá: không lọc/sắp DB theo tên (dùng `src/lib/name-search.ts`).
- Không thêm dependency. Chuỗi UI qua `t()`, thêm key vào cả `vi.json` và `en.json`.
- Ghi chú code tiếng Việt có dấu, 1–2 dòng. Commit 1 dòng, không body, không Co-Authored-By.
- Tháng "hiện tại" = giờ VN (`vnDateParts()` trong `@/lib/utils`).

## Review Focus

1. **Đổi cách thu giữa tháng**: tháng trước giữ số theo buổi, tháng này trọn gói, nợ chuyển tháng sau đúng — kể cả khi **chưa ai mở** tháng trước. Pin: Task 3 test "đổi sang trọn tháng tháng 10 → tháng 9 không đổi, nợ sang 11 đúng".
2. **Tháng không có ca / ca đã huỷ / ca đã xoá** không làm tháng thành "có ca". Pin: Task 3 tests.
3. **Báo cáo khoảng nhiều tháng + lọc khối**: HS trọn tháng cộng đúng 1 lần mỗi tháng, không nhân theo số buổi. Pin: Task 4 tests.
4. **Tạo HS trọn tháng rồi xếp ca lùi tháng trước** → tháng đó trọn gói (`from_key = 0`). Pin: Task 2 test.
5. **Đổi qua đổi lại trong 1 tháng** không sinh nhiều dòng lịch sử; đổi rồi đổi về giống tháng trước thì không còn dòng tháng này. Pin: Task 2 test.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | `StudentBillingChange`, `Student.billingMode/monthlyFee` | 1 |
| `prisma/migrations/<ts>_add_student_billing/migration.sql` | Mới | | 1 |
| `src/lib/billing.ts` | Mới | `BillingMode`, `monthKey`, `resolveBilling`, `monthFee`, `revenueForMonth` | 1 |
| `src/lib/schemas/student.ts` | Sửa | `billingMode`, `monthlyFee` | 2 |
| `src/server/services/billing.service.ts` | Mới | `loadBillingChanges`, `recordBillingChange` | 2 |
| `src/server/services/student.service.ts` | Sửa | create/update/import ghi lịch sử; DTO | 2, 7 |
| `src/lib/types/models.ts` | Sửa | `StudentDTO`, `TuitionStatusDTO` thêm trường | 2, 3 |
| `src/server/services/tuition.service.ts` | Sửa | Phí tháng + đi lịch sử theo cách thu | 3 |
| `src/server/services/report.service.ts` | Sửa | Doanh thu/dự kiến theo cách thu | 4 |
| `src/components/students/StudentFormDialog.tsx` | Sửa | Công tắc cách thu | 5 |
| `src/components/students/StudentList.tsx` (+ thẻ mobile) | Sửa | `…/tháng` / `…/buổi` | 5 |
| `src/components/sessions/AttendancePanel.tsx` | Sửa | Nhãn "Trọn tháng" | 5 |
| `src/components/tuition/*`, `src/components/parent/ParentView.tsx`, `src/server/services/tuition-notice.service.ts`, `parent-link.service.ts` | Sửa | Dòng "Học phí tháng (trọn gói)" | 6 |
| `src/lib/student-import.ts`, `src/lib/student-import-excel.ts` | Sửa | Cột "Cách thu" tuỳ chọn | 7 |
| `src/server/services/backup.service.ts` | Sửa | Cột + sheet lịch sử | 7 |
| `package.json`, `tests/e2e/t-hoc-phi-thang.spec.ts` | Sửa/Mới | 0.9.0, e2e | 8 |

---

### Task 1: Schema, migration, thư viện `billing`

**Files:** `prisma/schema.prisma`, migration mới, `src/lib/billing.ts`, `tests/unit/lib/billing.test.ts`

**Interfaces — Produces:**
```ts
export type BillingMode = "per_session" | "monthly"
export type BillingChange = { fromKey: number; mode: BillingMode; monthlyFee: number }
export type Billing = { mode: BillingMode; monthlyFee: number }
export const PER_SESSION: Billing
export function monthKey(year: number, month: number): number            // year*12 + month-1
export function resolveBilling(changes: BillingChange[], key: number): Billing  // fromKey lớn nhất ≤ key
// links của 1 HS trong 1 tháng (đã lọc ca sống, không huỷ)
export type MonthLink = { attendance: string; fee: number }
export function monthFee(billing: Billing, links: MonthLink[]): number    // trọn tháng: monthlyFee nếu links.length ≥ 1; theo buổi: Σ fee có mặt/đi muộn
export function revenueForMonth(billing: Billing, links: MonthLink[]): { expected: number; earned: number }
```

- [ ] **Step 1: Unit test** `tests/unit/lib/billing.test.ts`:
  - `monthKey(2026, 1) === 2026*12`, `monthKey(2026, 12) - monthKey(2026, 1) === 11`.
  - `resolveBilling([], k)` → `PER_SESSION`; changes `[{0, monthly, 400000}, {k10, per_session, 0}]`: key tháng 9 → monthly 400000; key tháng 10, 11 → per_session. Không phụ thuộc thứ tự mảng.
  - `monthFee(monthly 400k, [])` = 0; `[{absent,50000}]` = 400000; `[{present,50000},{present,50000}]` = 400000.
  - `monthFee(per_session, [{present,50000},{late,50000},{absent,50000},{pending,50000}])` = 100000.
  - `revenueForMonth(monthly 400k, [{pending}])` = `{ expected: 400000, earned: 0 }`; `[{pending},{absent}]` = `{400000, 400000}`; `[]` = `{0,0}`.
  - `revenueForMonth(per_session, [{present,50k},{pending,50k}])` = `{ expected: 100000, earned: 50000 }` (y hệt công thức cũ: expected = Σ fee mọi link, earned = Σ fee có mặt/đi muộn).
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt `src/lib/billing.ts`** đúng Interfaces (dùng `ATTENDANCE_STATUS` từ `@/lib/constants`). Ghi chú: trọn tháng tính 1 lần/tháng khi có ca (spec T2); doanh thu trọn tháng tính khi đã có buổi điểm danh.
- [ ] **Step 3: Schema**
```prisma
model Student {
  // … giữ nguyên, thêm:
  billingMode     String           @default("per_session") @map("billing_mode") @db.VarChar(20)
  monthlyFee      Int              @default(0) @map("monthly_fee")
  billingChanges  StudentBillingChange[]
}

model StudentBillingChange {
  id         Int      @id @default(autoincrement())
  studentId  Int      @map("student_id")
  // year*12 + month-1; 0 = áp cho mọi tháng (HS tạo mới đã chọn trọn tháng).
  fromKey    Int      @map("from_key")
  mode       String   @db.VarChar(20)
  monthlyFee Int      @default(0) @map("monthly_fee")
  createdAt  DateTime @default(now()) @map("created_at")
  student    Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, fromKey])
  @@map("student_billing_changes")
}
```
- [ ] **Step 4: Migration** `--create-only` trên DB test; kiểm SQL chỉ có `ALTER TABLE students ADD COLUMN …` (2 cột có DEFAULT) + `CREATE TABLE student_billing_changes` + unique index + FK cascade. Thêm `CHECK (mode IN ('per_session','monthly'))` và `CHECK (monthly_fee >= 0)` cho cả 2 bảng bằng tay vào SQL. `migrate deploy` lên DB test. `pnpm exec prisma generate`.
- [ ] **Step 5:** unit PASS; `pnpm test tests/integration/o-migration.test.ts tests/integration/student.test.ts` PASS; tsc sạch.
- [ ] **Step 6: Commit** `feat(t): bảng lịch sử cách thu học phí + thư viện tính phí theo buổi/trọn tháng`

---

### Task 2: Tạo/sửa HS ghi lịch sử cách thu

**Files:** `src/lib/schemas/student.ts`, `src/server/services/billing.service.ts` (mới), `src/server/services/student.service.ts` (create ~54, update ~154, `toStudentDTO`), `src/lib/types/models.ts` (`StudentDTO`)
**Test:** `tests/integration/student-billing.test.ts`

**Interfaces — Produces:**
```ts
// billing.service.ts
export async function loadBillingChanges(db: PrismaClient | Prisma.TransactionClient, studentIds: number[]): Promise<Map<number, BillingChange[]>>
export async function recordBillingChange(tx: Prisma.TransactionClient, studentId: number, fromKey: number, next: Billing): Promise<void>
// StudentDTO thêm: billingMode: BillingMode; monthlyFee: number
```

- [ ] **Step 1: Integration tests** (`getAuthedCaller`, `consent: CONSENT_ACCEPTED`, mốc "tháng hiện tại" dùng `vnDateParts()`):
  1. Tạo HS `billingMode: "monthly", monthlyFee: 400000` → 1 dòng lịch sử `fromKey 0`; DTO trả `billingMode "monthly"`, `monthlyFee 400000`.
  2. Tạo HS mặc định → 0 dòng lịch sử, `billingMode "per_session"`.
  3. Sửa HS theo buổi → trọn tháng 300000 → 1 dòng `fromKey = monthKey(tháng VN)`.
  4. Sửa tiếp trong cùng tháng lên 350000 → vẫn 1 dòng tháng này, `monthlyFee 350000`.
  5. HS tạo trọn tháng 400k (dòng 0) → sửa 500k (dòng tháng này) → sửa lại 400k → chỉ còn dòng 0 (dòng tháng này bị xoá vì trùng dòng liền trước).
  6. Sửa chỉ `fullName` → không thêm dòng.
  7. Input `billingMode: "weekly"` → BAD_REQUEST; `monthlyFee: -1` → BAD_REQUEST.
  Chạy → FAIL.
- [ ] **Step 2: Schema zod** — `studentCreateSchema` thêm `billingMode: z.enum(["per_session", "monthly"]).default("per_session")`, `monthlyFee: z.number().int().min(0).default(0)`. `studentImportSchema` kế thừa (qua `studentCreateSchema.omit`).
- [ ] **Step 3: billing.service** — `loadBillingChanges` = `findMany({ where: { studentId: { in } } })` gom theo HS. `recordBillingChange`:
```ts
await tx.studentBillingChange.upsert({ where: { studentId_fromKey: { studentId, fromKey } }, create: {…}, update: { mode, monthlyFee } })
const prev = await tx.studentBillingChange.findFirst({ where: { studentId, fromKey: { lt: fromKey } }, orderBy: { fromKey: "desc" } })
const prevBilling = prev ? { mode: prev.mode, monthlyFee: prev.monthlyFee } : PER_SESSION
// Đổi rồi đổi về như tháng trước → dòng tháng này thừa.
if (prevBilling.mode === next.mode && prevBilling.monthlyFee === next.monthlyFee) await tx.studentBillingChange.delete({ where: { studentId_fromKey: { studentId, fromKey } } })
```
  Chuẩn hoá: `per_session` luôn lưu `monthlyFee 0` ở cả `students` và lịch sử.
- [ ] **Step 4: student.service** — `createStudent`: bọc `$transaction`; tạo HS với `billingMode`, `monthlyFee` (0 nếu per_session); nếu monthly → `recordBillingChange(tx, id, 0, …)`. `updateStudent`: trong transaction sẵn có, nếu `data.billingMode`/`data.monthlyFee` có mặt và `(mode, fee)` sau chuẩn hoá khác `existing` → update cột + `recordBillingChange(tx, id, monthKey(vn hiện tại), next)`. `toStudentDTO` thêm 2 trường.
- [ ] **Step 5:** tests Task 2 PASS; `pnpm test tests/integration/student.test.ts tests/integration/consent.test.ts` PASS; tsc sạch.
- [ ] **Step 6: Commit** `feat(t): tạo/sửa học sinh lưu cách thu, đổi cách thu áp từ tháng hiện tại`

---

### Task 3: Tính học phí theo cách thu (tháng hiện tại + nợ chuyển)

**Files:** `src/server/services/tuition.service.ts` (`calcStudentTuition`, `computeClosingBalances`, `getMonthlyTuitionStatus`), `src/lib/types/models.ts` (`TuitionStatusDTO`)
**Test:** `tests/integration/tuition-monthly.test.ts`

**Interfaces:**
- Consumes: `resolveBilling`, `monthFee`, `monthKey` (Task 1); `loadBillingChanges` (Task 2).
- Produces: `TuitionStatusDTO` thêm `billingMode: BillingMode`, `monthlyFee: number` (cách thu **của tháng đang xem**, không phải hiện tại).

- [ ] **Step 1: Tests** (tạo ca qua `caller.session.create` + `addStudents` + `attendance.update`, như `tuition-past-month-resync.test.ts`; dùng năm 2026 tháng 3–6 để là quá khứ):
  1. HS tạo trọn tháng 400k; tháng 3 có 2 ca: 1 có mặt, 1 vắng → `getMonthlyStatus` tháng 3: `totalExpected 400000`, `totalSessions 2`, `presentSessions 1`, `billingMode "monthly"`.
  2. Cùng HS, tháng 4 không có ca → `totalExpected 0`, `previousBalance 400000` (chưa thu tháng 3).
  3. Tháng 5 chỉ có 1 ca **đã huỷ** (`caller.session.cancel` hoặc đường huỷ ca hiện có) → `totalExpected 0`. Ca đã xoá (Thùng rác) → cũng 0.
  4. HS theo buổi 50k: tháng 3 có mặt 2 buổi (100k). Ghi thẳng lịch sử `fromKey = monthKey(2026, 4)` monthly 300k (mô phỏng đổi vào tháng 4 bằng `db.studentBillingChange.create` + cập nhật cột), tháng 4 có 1 buổi có mặt. **Không mở tháng 3**, mở thẳng tháng 5 → `previousBalance` = 100000 + 300000 = 400000. Mở tháng 3 → `totalExpected 100000`, `billingMode "per_session"`; tháng 4 → `300000`, `"monthly"`.
  5. Thu 400k tháng 3 cho HS ở ca 1 → tháng 4 `previousBalance 0`.
  6. Tất toán tháng có trọn gói mà mới thu 100k → không mang nợ dương sang (như cũ).
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - `getMonthlyTuitionStatus`: sau khi có `studentIds`, `const billingMap = await loadBillingChanges(db, studentIds)` (chạy song song trong `Promise.all` cùng các query hiện có). `key = monthKey(year, month)`.
  - `calcStudentTuition(attendance, snapshot, previousBalance, billing)`: `currentMonthFee = monthFee(billing, attendance.map(a => ({ attendance: a.attendance, fee: a.fee })))` (attendance hiện đã lọc ca sống, không huỷ). Giữ đếm `totalSessions`/`presentSessions`.
  - `computeClosingBalances(db, userId, studentIds, year, month, billingMap?)`: truy vấn link lịch sử bỏ điều kiện `attendance in (present, late)` — lấy mọi link sống không huỷ, `select: { studentId, fee, attendance, session: { select: { sessionDate } } }`; gom theo tháng thành `MonthLink[]`; mỗi tháng `fee = monthFee(resolveBilling(changes, key), links)`. Nếu `billingMap` không truyền → tự `loadBillingChanges`. `countDebtMonths` (report.service) truyền qua không đổi chữ ký ngoài.
  - DTO item thêm `billingMode`, `monthlyFee` từ `resolveBilling(changes, key)`.
- [ ] **Step 3:** tests Task 3 PASS; `pnpm test tests/integration/tuition*.test.ts tests/integration/dashboard-alerts.test.ts tests/integration/payment.test.ts tests/integration/group-b-financial.test.ts` PASS (HS theo buổi không đổi số).
- [ ] **Step 4: Commit** `feat(t): học phí trọn tháng thu đủ khi tháng có ca, nợ chuyển tháng theo lịch sử cách thu`

---

### Task 4: Báo cáo & Tổng quan theo cách thu

**Files:** `src/server/services/report.service.ts` (`getStudentReport` ~55-65, `getMonthlySummary` ~152-169, `getDashboardStats` ~257-273)
**Test:** `tests/integration/report-monthly-billing.test.ts`

- [ ] **Step 1: Tests**
  1. Tháng có HS A theo buổi 50k (2 có mặt, 1 chưa điểm danh) + HS B trọn tháng 400k (1 vắng, 1 chưa điểm danh) → `monthlySummary`: `expectedRevenue = 150000 + 400000`, `totalRevenue = 100000 + 400000`.
  2. HS B chỉ có ca chưa điểm danh → `expectedRevenue` có 400k, `totalRevenue` không có.
  3. Khoảng 2 tháng, B có ca cả 2 tháng → B cộng 800k expected.
  4. Lọc khối: B lớp 5 → `grade: 5` có 400k, `grade: 6` không có.
  5. `dashboard()` tháng hiện tại khớp công thức ở 1 (dùng ngày trong tháng VN hiện tại như `report-deleted-students.test.ts`).
  6. `studentReport` của B 1 tháng: `expectedRevenue 400000`, `totalRevenue 400000` khi đã có buổi điểm danh.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt** — helper nội bộ trong report.service:
```ts
// Gom link theo (HS, tháng) rồi tính theo cách thu tháng đó: trọn tháng cộng 1 lần/tháng.
function sumRevenue(
  links: { studentId: number; attendance: string; fee: number; sessionDate: Date }[],
  billingMap: Map<number, BillingChange[]>
): { expected: number; earned: number }
```
  Mỗi hàm: thu link (đã lọc khối như hiện tại) → `sumRevenue` thay cho vòng cộng `ss.fee`. Tỷ lệ điểm danh, số buổi, số HS giữ vòng cũ. `billingMap = await loadBillingChanges(db, [...studentIds])`.
- [ ] **Step 3:** tests Task 4 PASS; `pnpm test tests/integration/report*.test.ts tests/integration/tuition-report-consistency.test.ts` PASS.
- [ ] **Step 4: Commit** `feat(t): báo cáo, tổng quan tính doanh thu học sinh trọn tháng 1 lần mỗi tháng`

---

### Task 5: Form, danh sách HS, điểm danh

**Files:** `StudentFormDialog.tsx`, `StudentList.tsx` (bảng + thẻ mobile), `AttendancePanel.tsx`, `vi.json`, `en.json`
**Test:** `tests/unit/components/StudentFormDialog.test.tsx` (thêm/tạo), `tests/unit/components/AttendancePanel.test.tsx` (thêm/tạo)

- [ ] **Step 1: Tests**
  - Form: bấm "Trọn tháng" → nhãn ô tiền "Học phí/tháng"; nhập 400000; bấm "Theo buổi" → ô hiện lại giá/buổi cũ (vd 50000); bấm lại "Trọn tháng" → 400000. Submit gửi `billingMode: "monthly", monthlyFee: 400000, tuitionFee: 50000`.
  - Form sửa HS đang học, đổi cách thu → hiện "Áp dụng từ tháng {m}/{y}; các tháng trước giữ nguyên." Không đổi → không hiện.
  - AttendancePanel: HS `billingMode "monthly"` không có ô sửa phí, có nhãn "Trọn tháng"; HS theo buổi vẫn có ô phí.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt** — công tắc 2 nút dùng `role="radiogroup"` (mẫu `src/lib/radio-group-keys.ts` nếu đang dùng ở form khác), mỗi nút ≥ 44px mobile. AttendancePanel cần `billingMode` của từng HS: thêm `billingMode` vào `SessionStudentDTO.student` (hoặc trường cùng cấp) ở `session.service.ts` `toDTO` từ `ss.student.billingMode` khi `includeStudents`; kiểm getSessionDetail include có `student`. Danh sách HS: `formatCurrency(fee)` + `t("per_month")`/`t("per_session")`.
  Key i18n: `billing_per_session` ("Theo buổi"/"Per session"), `billing_monthly` ("Trọn tháng"/"Monthly"), `fee_per_session_label` ("Học phí/buổi"), `fee_per_month_label` ("Học phí/tháng"), `per_month` ("/tháng"), `per_session` ("/buổi"), `billing_change_note` ("Áp dụng từ tháng {m}/{y}; các tháng trước giữ nguyên.").
- [ ] **Step 3:** tests PASS; `pnpm test tests/unit/components` PASS; tsc, lint sạch.
- [ ] **Step 4: Commit** `feat(t): form học sinh chọn thu theo buổi/trọn tháng, danh sách và điểm danh hiện đúng`

---

### Task 6: Sheet học phí, phiếu báo QR, trang phụ huynh

**Files:** `src/components/tuition/*` (sheet chi tiết HS + `TuitionNoticeCard.tsx`), `src/server/services/tuition-notice.service.ts`, `src/server/services/parent-link.service.ts`, `src/components/parent/ParentView.tsx`
**Test:** `tests/integration/tuition-notice.test.ts`, `tests/integration/parent-link.test.ts` (thêm case), component test `TuitionNoticeCard`

- [ ] **Step 1: Tests** — HS trọn tháng 400k, tháng có 2 ca (1 có mặt): `getNotice` trả `billingMode "monthly"`, `monthlyFee 400000`, `currentMonthFee 400000`; `getParentView` cùng tháng có `billingMode`/`monthlyFee`. `TuitionNoticeCard` với `billingMode "monthly"` hiện "Học phí tháng (trọn gói): 400.000 đ · Đã học 1/2 buổi" và **không** hiện tiền từng buổi; theo buổi giữ nguyên như cũ. Chạy → FAIL.
- [ ] **Step 2: Cài đặt** — truyền `billingMode`, `monthlyFee` từ `TuitionStatusDTO` qua notice/parent DTO; UI rẽ nhánh theo `billingMode`. Key i18n `monthly_fee_line` ("Học phí tháng (trọn gói): {amount} · Đã học {p}/{n} buổi" / "Monthly fee (flat): {amount} · Attended {p}/{n} sessions").
- [ ] **Step 3:** tests PASS; `pnpm exec playwright test tests/e2e/tuition-notice.spec.ts tests/e2e/parent-link.spec.ts` PASS.
- [ ] **Step 4: Commit** `feat(t): phiếu báo, sheet học phí, trang phụ huynh hiện học phí trọn tháng`

---

### Task 7: Nhập Excel & sao lưu

**Files:** `src/lib/student-import.ts`, `src/lib/student-import-excel.ts`, `src/server/services/student.service.ts` (`importStudents`), `src/server/services/backup.service.ts`
**Test:** `tests/unit/lib/student-import.test.ts`, `tests/integration/student-import.test.ts`, `tests/integration/backup.test.ts`

- [ ] **Step 1: Tests**
  - File **5 cột cũ** (không có "Cách thu") vẫn nhận, mọi dòng `per_session`.
  - File 6 cột, cột 6 "Cách thu": `tháng`/`Thang`/`THÁNG` → monthly, mức = cột "Học phí"; `buổi`/rỗng → per_session; giá trị khác → dòng lỗi cột "Cách thu".
  - `importMany` dòng monthly → HS `billingMode "monthly"`, `monthlyFee` = số, `tuitionFee 0`, có dòng lịch sử `fromKey 0`.
  - Backup: sheet Học sinh có cột "Cách thu", "Học phí tháng"; sheet "Lịch sử cách thu" có dòng của HS monthly.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - Import: kiểm tiêu đề **5 cột đầu** như cũ; cột 6 chỉ đọc nếu tiêu đề (chuẩn hoá) là "cach thu". Cột "Học phí/buổi" đổi nhãn file mẫu thành "Học phí" nhưng vẫn chấp nhận tiêu đề cũ "Học phí/buổi". File mẫu thêm cột "Cách thu" + dòng hướng dẫn ("buổi hoặc tháng, bỏ trống là buổi").
  - `importStudents`: dòng monthly → `monthlyFee = r.tuitionFee` từ file, `tuitionFee = 0`. Dùng `tx.student.createManyAndReturn` (extension mã hoá đã hỗ trợ) để có id, rồi `tx.studentBillingChange.createMany` cho dòng monthly (`fromKey 0`).
  - Backup: thêm 2 cột vào sheet Học sinh; sheet mới "Lịch sử cách thu" (Học sinh, Từ tháng `MM/YYYY` hoặc "Từ đầu", Cách thu, Học phí tháng).
- [ ] **Step 3:** tests PASS; `pnpm exec playwright test tests/e2e/students-import.spec.ts tests/e2e/backup.spec.ts` PASS.
- [ ] **Step 4: Commit** `feat(t): nhập Excel có cột Cách thu, sao lưu có cách thu và lịch sử`

---

### Task 8: Version 0.9.0, e2e, hồi quy

- [ ] **Step 1: E2E `tests/e2e/t-hoc-phi-thang.spec.ts`** (390px và 1280px): thêm HS "Trọn tháng" 400.000 (tick đồng ý) → danh sách hiện `400.000 đ/tháng` → tạo 2 ca hôm nay có HS → điểm danh 1 có mặt 1 vắng → màn Học phí tháng này: thẻ HS hiện 400.000 và "1/2" → mở phiếu báo: có "trọn gói". Dọn dữ liệu `afterAll`.
- [ ] **Step 2:** `package.json` → `0.9.0`.
- [ ] **Step 3: Hồi quy** — tsc, lint, `pnpm test`, seed rồi full `pnpm exec playwright test`. Lỗi dữ liệu test đã biết → chạy lại riêng, ghi báo cáo.
- [ ] **Step 4: Commit** `chore(t): nâng version 0.9.0, e2e học phí trọn tháng`
- [ ] **Step 5:** Báo cáo `.superpowers/gehihi/bao-cao-T.md` + ghi `DONE T` vào kênh.
