# R — "Đã nghỉ" / Xoá rõ ràng, Dọn Thùng rác, tiền HS đã xoá vẫn tính — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách rõ "Đã nghỉ" và "Xoá" học sinh (chỉ xoá HS "sạch"), cho giáo viên dọn Thùng rác vĩnh viễn, và giữ tiền/điểm danh của HS đã xoá trong Báo cáo + Tổng quan.

**Architecture:** Quy tắc xoá nằm ở 1 hàm server `checkStudentDeletable` dùng chung cho `student.delete` (ném lỗi) và query mới `student.deleteCheck` (trả kết quả cho hộp thoại). Dọn Thùng rác là service mới `trash-purge.service.ts` (ca/lần thu xoá cứng, HS ẩn danh + `purgedAt`, môn xoá cứng hoặc `purgedAt`). Báo cáo/Tổng quan đổi bộ lọc liên kết HS sang `HISTORY_LINK = {}` để tính cả HS đã xoá.

**Tech Stack:** Next.js 15 App Router, tRPC v11 (không transformer — Date về client là string), Prisma 5.22 + Postgres, Vitest (+ jsdom cho component), Playwright, shadcn/ui (AlertDialog, DropdownMenu), sonner.

**Spec:** `docs/superpowers/specs/2026-09-28-r-da-nghi-don-thung-rac-design.md` (R1–R9, mục 3–11).

## Global Constraints

- **Người thực thi: Gehihi (Antigravity).** Đọc `GEMINI.md` trước. KHÔNG merge, KHÔNG push, KHÔNG tạo backup Neon, KHÔNG chạy gì lên prod — việc của Claude Code.
- `.env` là **PRODUCTION** (`ep-polished-voice`). Test chỉ qua `pnpm test …` (tự nạp `.env.test`, `localhost:5433`). Cấm `pnpm build`, `pnpm dev`, `db:reset`, `migrate reset`, `db push --force-reset`.
- Migration chỉ lên DB test: `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name add_purged_at` rồi `... pnpm exec prisma migrate deploy`; dòng Datasource phải in `localhost:5433`. Prisma đòi reset / báo drift → DỪNG, ghi `STOP R Task 1` vào kênh.
- Version: **0.7.0** (Task 7). Epoch 0.7 → mọi người đăng nhập lại 1 lần (đúng luật N).
- Chữ UI tiếng Việt dùng "Xóa" (ó) như các key sẵn có (`delete`: "Xóa"); `vi.json` và `en.json` phải cùng bộ key.
- Mobile ≥ 375px, vùng chạm ≥ 44px (`min-h-11` / `h-11` mobile, `md:` thu nhỏ).
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc.
- Giữ kiểu xuống dòng của từng file (repo `core.autocrlf=true`). Chỉ `git add` đúng file của task. Không `git stash`.
- Commit trailer của Gehihi (không ghi Claude).
- Kênh: xong plan → ghi `bao-cao-R.md` + dòng `DONE R` vào `.superpowers/gehihi/kenh.md` (GEMINI.md mục 4).

## Điều chỉnh so với spec

- Spec mục 8 liệt kê key `close`: key này chưa có → thêm (`"close": "Đóng"` / `"Close"`).
- Tên hàm quy tắc: spec viết `assertStudentDeletable`; plan dùng `checkStudentDeletable` (trả kết quả) + `softDeleteStudent` tự ném lỗi từ kết quả đó — một nguồn sự thật, không cần 2 hàm.
- Test Q cũ xoá HS có dữ liệu sẽ đỏ vì R2 — plan chỉ rõ từng chỗ sửa (Task 2, 3, 5). Không được đổi ý nghĩa test ngoài những chỗ ghi ở đây.

## Review Focus

1. **HS đã nghỉ, tháng này không có ca nhưng còn nợ tháng trước (carry-over):** phải bị chặn với đúng số nợ lũy kế. Pin: Task 2 `student-delete-rules.test.ts` ("đã nghỉ, nợ từ tháng trước → debt").
2. **Dọn HS rồi mở Báo cáo tháng cũ / link phụ huynh cũ:** số Báo cáo không đổi; link trả null. Pin: Task 3 `report-deleted-students.test.ts` + Task 4 `trash-purge.test.ts` ("dọn HS: ẩn danh, giữ tiền, link chết").
3. **Dọn môn khi ca đã xoá (chưa dọn) vẫn dùng môn:** không lỗi khoá ngoại, môn nhận `purgedAt`, biến khỏi Thùng rác. Pin: Task 4 ("môn còn ca đã xoá → purgedAt").
4. **Bấm Dọn 2 lần (2 tab):** lần 2 trả 0, không lỗi. Pin: Task 4 ("dọn lần 2 → 0").
5. **Giáo viên khác:** không dọn/không đếm được dữ liệu của người khác. Pin: Task 4 ("chỉ dọn của mình").

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | `purgedAt` ở `Student`, `Subject` | 1 |
| `prisma/migrations/<ts>_add_purged_at/migration.sql` | Tạo | 2 × ADD COLUMN | 1 |
| `src/server/services/student-delete-rules.ts` | Tạo | `checkStudentDeletable` | 2 |
| `src/server/services/student.service.ts` | Sửa | `softDeleteStudent` gọi quy tắc | 2 |
| `src/server/trpc/routers/student.ts` | Sửa | query `deleteCheck` | 2 |
| `src/server/soft-delete.ts` | Sửa | `HISTORY_LINK` | 3 |
| `src/server/services/report.service.ts` | Sửa | Báo cáo/Tổng quan tính HS đã xoá | 3 |
| `src/server/services/trash-purge.service.ts` | Tạo | dọn từng loại + dọn sạch | 4 |
| `src/server/services/trash.service.ts` | Sửa | counts/list/restore bỏ bản đã dọn | 4 |
| `src/lib/schemas/trash.ts` | Sửa | `trashPurgeSchema` | 4 |
| `src/server/trpc/routers/trash.ts` | Sửa | `purge`, `purgeAll` | 4 |
| `src/components/students/DeleteStudentDialog.tsx` | Viết lại | 3 trạng thái, bỏ "Cho nghỉ thay" | 5 |
| `src/components/students/StudentList.tsx` | Sửa | menu Đã nghỉ / Học lại / Xóa + mô tả | 5 |
| `src/components/trash/PurgeDialog.tsx` | Tạo | popup xoá vĩnh viễn | 6 |
| `src/components/trash/TrashList.tsx` | Sửa | nút dọn, phân trang | 6 |
| `src/language/vi.json`, `en.json` | Sửa | key mục 8 spec | 5, 6 |
| `package.json` | Sửa | `0.7.0` | 7 |

Test: `tests/integration/student-delete-rules.test.ts` (T2), `tests/integration/report-deleted-students.test.ts` (T3), `tests/integration/trash-purge.test.ts` (T4), `tests/unit/components/DeleteStudentDialog.test.tsx` (T5, viết lại), `tests/unit/components/StudentActionsMenu.test.tsx` (T5), `tests/unit/components/TrashList.test.tsx` (T6, thêm), `tests/e2e/trash.spec.ts` (T5 sửa test 4), `tests/e2e/trash-purge.spec.ts` (T6).

---

### Task 1: Nhánh + migration `purged_at`

**Files:**
- Modify: `prisma/schema.prisma` (model `Student`, `Subject`)
- Create: `prisma/migrations/<timestamp>_add_purged_at/migration.sql` (Prisma sinh)

**Interfaces:**
- Produces: `Student.purgedAt: Date | null`, `Subject.purgedAt: Date | null` (cột `purged_at`).

- [ ] **Step 1: Kiểm K đã merge, tạo nhánh**

```bash
git checkout main
git pull --ff-only
git log --oneline -30 main | grep -iE "merge feat/k-|\(k\)" | head -3
grep '"version"' package.json
git checkout -b feat/r-da-nghi-thung-rac
```
Expected: có commit merge K; version `0.6.x`. Không có merge K → **DỪNG**, ghi `STOP R Task 1 — K chưa merge` vào kênh. Spec + plan R đã nằm sẵn trên `main` (không phải commit docs).

- [ ] **Step 2: Xác nhận DB test**

```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 3: Sửa schema**

Trong `model Student`, ngay dưới dòng `deletedAt       DateTime?        @map("deleted_at")` thêm:
```prisma
  purgedAt        DateTime?        @map("purged_at")
```
Trong `model Subject`, ngay dưới dòng `deletedAt DateTime? @map("deleted_at")` thêm:
```prisma
  purgedAt  DateTime? @map("purged_at")
```

- [ ] **Step 4: Sinh + áp migration lên DB test**

```bash
T=$(grep -E '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"'); D=$(grep -E '^DIRECT_URL=' .env.test | cut -d= -f2- | tr -d '"'); D=${D:-$T}
DATABASE_URL="$T" DIRECT_URL="$D" pnpm exec prisma migrate dev --create-only --name add_purged_at
cat prisma/migrations/*_add_purged_at/migration.sql
DATABASE_URL="$T" DIRECT_URL="$D" pnpm exec prisma migrate deploy
pnpm exec prisma generate
```
Expected: SQL đúng 2 lệnh `ALTER TABLE "students" ADD COLUMN "purged_at" TIMESTAMP(3);` và `ALTER TABLE "subjects" ADD COLUMN "purged_at" TIMESTAMP(3);`; deploy in Datasource `localhost:5433`, "1 migration … applied". Có DROP/RENAME hoặc đòi reset → DỪNG.

- [ ] **Step 5: Kiểm + commit**

Run: `pnpm exec tsc --noEmit` → 0 lỗi. `pnpm test tests/integration/soft-delete-migration.test.ts` → PASS.
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(r): migration thêm purged_at cho học sinh và môn (dọn Thùng rác)"
```

---

### Task 2: Quy tắc xoá HS (server) + `student.deleteCheck`

**Files:**
- Create: `src/server/services/student-delete-rules.ts`
- Modify: `src/server/services/student.service.ts` (`softDeleteStudent`)
- Modify: `src/server/trpc/routers/student.ts`
- Modify: `tests/integration/soft-delete-tuition.test.ts` (test link phụ huynh, dòng ~92)
- Test: `tests/integration/student-delete-rules.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DeleteCheck =
    | { allowed: true }
    | { allowed: false; reason: "active_with_data" }
    | { allowed: false; reason: "debt"; debt: number }
  export async function checkStudentDeletable(db: PrismaClient, userId: number, student: { id: number; isActive: boolean }): Promise<DeleteCheck>
  ```
  tRPC: `student.deleteCheck` query input `{ id: number }` → `DeleteCheck`. `student.delete` bị chặn → `BAD_REQUEST`, message: `"Không xoá được: học sinh đang học và đã có buổi học hoặc lần thu. Hãy chọn Đã nghỉ trước."` hoặc `` `Không xoá được: học sinh còn nợ ${formatCurrency(debt)}. Thu hết nợ trước khi xoá.` ``

- [ ] **Step 1: Viết test (đỏ)** — `tests/integration/student-delete-rules.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const PAST = "2030-05-06" // tháng quá khứ cố định; nợ lũy kế tính tới tháng VN hiện tại

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function withPresent(fee = 100_000) {
  const caller = await getAuthedCaller()
  const st = await caller.student.create({ fullName: "HS Quy tắc", grade: 6, tuitionFee: fee })
  const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
  const s = await caller.session.create({ sessionDate: PAST, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [st.id] })
  await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
  return { caller, st, s }
}

describe("Quy tắc xoá học sinh (spec R2)", () => {
  beforeEach(clean)

  it("HS mới chưa có dữ liệu → xoá được", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Nhầm", grade: 3 })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
    await caller.student.delete({ id: st.id })
    expect(await db.student.findUnique({ where: { id: st.id, isDeleted: true } })).not.toBeNull()
  })

  it("buổi vắng (absent) không tính là dữ liệu → xoá được", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Vắng", grade: 3, tuitionFee: 100_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: PAST, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "absent" }] })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
  })

  it("đang học + có buổi có mặt → active_with_data, delete → BAD_REQUEST", async () => {
    const { caller, st } = await withPresent()
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: false, reason: "active_with_data" })
    await expect(caller.student.delete({ id: st.id })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/Đã nghỉ/) })
  })

  it("đang học + chỉ có lần thu → active_with_data", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Thu", grade: 6 })
    await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 10_000, paidAt: "2030-05-20", method: "cash" })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: false, reason: "active_with_data" })
  })

  it("lần thu đã ở Thùng rác không tính là dữ liệu", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Thu nhầm", grade: 6 })
    const p = await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 10_000, paidAt: "2030-05-20", method: "cash" })
    await caller.payment.delete({ id: p.id })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
  })

  it("đã nghỉ, nợ từ tháng trước (carry-over) → debt đúng số, delete → BAD_REQUEST", async () => {
    const { caller, st } = await withPresent(100_000)
    await caller.student.deactivate({ id: st.id })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: false, reason: "debt", debt: 100_000 })
    await expect(caller.student.delete({ id: st.id })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/100\.000/) })
  })

  it("đã nghỉ, đã trả hết → xoá được", async () => {
    const { caller, st } = await withPresent(100_000)
    await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 100_000, paidAt: "2030-05-20", method: "cash" })
    await caller.student.deactivate({ id: st.id })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
    await caller.student.delete({ id: st.id })
  })

  it("HS người khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const st = await caller.student.create({ fullName: "HS Của tôi", grade: 3 })
    await expect(other.student.deleteCheck({ id: st.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm test tests/integration/student-delete-rules.test.ts`
Expected: FAIL — `student.deleteCheck` không tồn tại (TypeError / "No procedure found").

- [ ] **Step 3: Viết `src/server/services/student-delete-rules.ts`**

```ts
import type { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { vnDateParts } from "@/lib/utils"
import { getMonthlyTuitionStatus } from "./tuition.service"

export type DeleteCheck =
  | { allowed: true }
  | { allowed: false; reason: "active_with_data" }
  | { allowed: false; reason: "debt"; debt: number }

// Chỉ xoá HS "sạch" (spec R2): chưa có dữ liệu học, hoặc đã nghỉ và hết nợ lũy kế.
export async function checkStudentDeletable(
  db: PrismaClient,
  userId: number,
  student: { id: number; isActive: boolean }
): Promise<DeleteCheck> {
  const [attended, paid] = await Promise.all([
    db.sessionStudent.count({
      where: {
        studentId: student.id,
        attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        session: { isDeleted: false },
      },
    }),
    db.payment.count({ where: { monthlyTuition: { studentId: student.id } } }),
  ])
  if (attended === 0 && paid === 0) return { allowed: true }
  if (student.isActive) return { allowed: false, reason: "active_with_data" }

  const { year, month } = vnDateParts()
  const status = await getMonthlyTuitionStatus(
    db,
    userId,
    { year, month, status: "all", page: 1, limit: 1 },
    false,
    [student.id]
  )
  const row = status.items[0]
  const debt = row && !row.isFullPaid ? Math.max(0, row.totalAmountDue - row.paidAmount) : 0
  return debt > 0 ? { allowed: false, reason: "debt", debt } : { allowed: true }
}
```

> `db.payment.count` được extension tự thêm `isDeleted: false` (lần thu ở Thùng rác không tính). `sessionStudent` không thuộc extension → lọc `session.isDeleted` tay. Nếu `MonthlyTuitionFilterInput` đòi thêm field bắt buộc (`grade`, `search`, `studentId`) → truyền `undefined`/giá trị mặc định theo schema thật, ghi Ruling.

- [ ] **Step 4: `softDeleteStudent` gọi quy tắc** — `src/server/services/student.service.ts`

Thêm import đầu file:
```ts
import { checkStudentDeletable } from "./student-delete-rules"
import { formatCurrency } from "@/lib/utils"
```
(nếu `formatCurrency` đã import từ `@/lib/utils` thì gộp vào import sẵn có.)

Thay thân `softDeleteStudent`:
```ts
// Xoá mềm: không đụng isActive/ca/link phụ huynh để khôi phục trả nguyên trạng (spec Q Q4). Chỉ HS "sạch" (spec R2).
export async function softDeleteStudent(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<{ success: true }> {
  const existing = await db.student.findUnique({ where: { id } })
  assertOwnership(existing, userId)
  const check = await checkStudentDeletable(db, userId, existing)
  if (!check.allowed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        check.reason === "debt"
          ? `Không xoá được: học sinh còn nợ ${formatCurrency(check.debt)}. Thu hết nợ trước khi xoá.`
          : "Không xoá được: học sinh đang học và đã có buổi học hoặc lần thu. Hãy chọn Đã nghỉ trước.",
    })
  }
  await db.student.update({ where: { id }, data: softDeleteData() })
  return { success: true }
}

export async function getStudentDeleteCheck(db: PrismaClient, userId: number, id: number) {
  const existing = await db.student.findUnique({ where: { id } })
  assertOwnership(existing, userId)
  return checkStudentDeletable(db, userId, existing)
}
```

- [ ] **Step 5: Router** — `src/server/trpc/routers/student.ts`

Thêm `getStudentDeleteCheck` vào import từ `@/server/services/student.service`, và thêm ngay trước `delete:`:
```ts
  deleteCheck: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => getStudentDeleteCheck(ctx.db, ctx.userId, input.id)),

```

- [ ] **Step 6: Chạy lại test mới**

Run: `pnpm test tests/integration/student-delete-rules.test.ts`
Expected: PASS 8/8.

- [ ] **Step 7: Sửa test Q bị quy tắc mới chặn**

`tests/integration/soft-delete-tuition.test.ts`, test "link phụ huynh…" (có dòng `await caller.student.delete({ id: st.id })` sau `session.delete`): HS còn lần thu 40.000 đang sống và đang học → bị chặn. Ngay trước dòng `await caller.student.delete({ id: st.id })` của test đó thêm:
```ts
    await caller.student.deactivate({ id: st.id }) // R2: HS có lần thu phải Đã nghỉ + hết nợ mới xoá được
```
(ca đã xoá → không còn phí, đã trả 40.000 → không nợ.) Test "xoá HS → biến khỏi học phí, báo cáo tháng…" (dòng ~61) để Task 3 viết lại — ở Task 2 nó sẽ đỏ vì BAD_REQUEST, chấp nhận tạm, KHÔNG sửa ở Task 2.

Run: `pnpm test tests/integration/soft-delete-tuition.test.ts tests/integration/soft-delete-students-subjects.test.ts tests/integration/student.test.ts tests/integration/trash.test.ts tests/integration/multi-tenant.test.ts`
Expected: chỉ đỏ đúng 1 test "xoá HS → biến khỏi học phí, báo cáo tháng, sao lưu…" (sửa ở Task 3). Đỏ test khác → đọc lý do; nếu do R2 chặn xoá HS có dữ liệu mà ý test không phải kiểm quy tắc xoá → thêm `deactivate` + trả hết nợ trước khi xoá như trên, ghi Ruling.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/student-delete-rules.ts src/server/services/student.service.ts src/server/trpc/routers/student.ts tests/integration/student-delete-rules.test.ts tests/integration/soft-delete-tuition.test.ts
git commit -m "feat(r): chỉ xoá học sinh sạch (chưa có dữ liệu, hoặc đã nghỉ + hết nợ), query student.deleteCheck"
```

---

### Task 3: Báo cáo + Tổng quan tính cả HS đã xoá

**Files:**
- Modify: `src/server/soft-delete.ts`
- Modify: `src/server/services/report.service.ts` (`getMonthlySummary`, `getDashboardStats`)
- Modify: `tests/integration/soft-delete-tuition.test.ts` (test "xoá HS → biến khỏi…")
- Test: `tests/integration/report-deleted-students.test.ts`

**Interfaces:**
- Consumes: quy tắc xoá Task 2 (test phải cho nghỉ + trả hết nợ trước khi xoá).
- Produces: `export const HISTORY_LINK = {} as const` trong `@/server/soft-delete`.

- [ ] **Step 1: Viết test (đỏ)** — `tests/integration/report-deleted-students.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

// Ngày 1 tháng VN hiện tại: Tổng quan chỉ xem tháng này.
function thisMonth() {
  const v = new Date(Date.now() + 7 * 3600_000)
  const y = v.getUTCFullYear()
  const m = v.getUTCMonth() + 1
  return { y, m, day: `${y}-${String(m).padStart(2, "0")}-01` }
}

describe("Tiền của HS đã xoá vẫn tính (spec R8)", () => {
  beforeEach(clean)

  it("Báo cáo + Tổng quan giữ nguyên sau khi xoá (và sau khi dọn) HS đã nghỉ hết nợ", async () => {
    const { y, m, day } = thisMonth()
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Doanh thu", grade: 7, tuitionFee: 150_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: day, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: y, month: m, amount: 150_000, paidAt: day, method: "cash" })

    const sumBefore = await caller.report.monthlySummary({ year: y, month: m })
    const dashBefore = await caller.report.dashboard()
    expect(sumBefore).toMatchObject({ totalPaid: 150_000, totalRevenue: 150_000, totalStudents: 1 })

    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })

    const sumAfter = await caller.report.monthlySummary({ year: y, month: m })
    const dashAfter = await caller.report.dashboard()
    expect(sumAfter).toMatchObject({
      totalPaid: sumBefore.totalPaid,
      totalRevenue: sumBefore.totalRevenue,
      expectedRevenue: sumBefore.expectedRevenue,
      totalStudents: sumBefore.totalStudents,
      totalOutstanding: sumBefore.totalOutstanding,
    })
    expect(dashAfter).toMatchObject({
      totalPaidMonth: dashBefore.totalPaidMonth,
      totalRevenueMonth: dashBefore.totalRevenueMonth,
      attendanceRate: dashBefore.attendanceRate,
    })
    // HS đang học giảm 1 vì HS đã nghỉ + xoá.
    expect(dashAfter.totalStudents).toBe(dashBefore.totalStudents - 1)
  })

  it("lọc theo khối vẫn tính HS đã xoá của khối đó", async () => {
    const { y, m, day } = thisMonth()
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Khối", grade: 8, tuitionFee: 90_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: day, startTime: "05:00", endTime: "06:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: y, month: m, amount: 90_000, paidAt: day, method: "cash" })
    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })
    expect(await caller.report.monthlySummary({ year: y, month: m, grade: 8 })).toMatchObject({ totalPaid: 90_000, totalRevenue: 90_000, totalStudents: 1 })
  })
})
```

> Tên procedure: nếu router báo cáo đặt tên khác `report.monthlySummary` / `report.dashboard` (xem `src/server/trpc/routers/report.ts`), dùng tên thật, ghi Ruling. Các test này chạy trên DB test dùng chung với seed: số tuyệt đối của Tổng quan có thể có dữ liệu khác → chỉ so trước/sau như trên, không so số tuyệt đối trừ `monthlySummary` ở tháng hiện tại khi `clean()` đã xoá hết HS của mọi user (bảng xoá toàn bộ).

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm test tests/integration/report-deleted-students.test.ts`
Expected: FAIL — sau khi xoá `totalPaid`/`totalRevenue` về 0 (`expected 0 to be 150000`).

- [ ] **Step 3: `HISTORY_LINK`** — `src/server/soft-delete.ts`, ngay dưới dòng `export const LIVE_LINK = …`:

```ts
// Số liệu tiền/điểm danh lịch sử (Báo cáo, Tổng quan) tính cả HS đã xoá: tiền đã thu là tiền thật (spec R8).
export const HISTORY_LINK = {} as const
```

- [ ] **Step 4: Sửa `getMonthlySummary`** — `src/server/services/report.service.ts`

Import thêm `HISTORY_LINK` cạnh `LIVE_LINK`. Trong `getMonthlySummary`:
1. Nhánh `grade` của `monthlyTuitionsWhere`: `student: { userId, isDeleted: false, sessionStudents: … }` → bỏ `isDeleted: false` (giữ `session: { …, isDeleted: false }`).
2. Nhánh không grade: `student: { userId, isDeleted: false }` → `student: { userId }`.
3. `db.teachingSession.findMany`: `sessionStudents: { some: { grade, ...LIVE_LINK } }` → `{ some: { grade, ...HISTORY_LINK } }`; `include: { sessionStudents: { where: LIVE_LINK, include: { student: true } } }` → `where: HISTORY_LINK`.
4. `getMonthlyOutstanding(...)` giữ nguyên.

- [ ] **Step 5: Sửa `getDashboardStats`** (cùng file)

1. `include: { sessionStudents: { where: LIVE_LINK } }` → `where: HISTORY_LINK`.
2. `paidAgg`: `where: { student: { userId, isDeleted: false }, year: vnYear, month: vnMonth }` → `where: { student: { userId }, year: vnYear, month: vnMonth }`.
3. `totalStudents` (`db.student.count`) giữ nguyên.

> `db.monthlyTuition` không thuộc extension xoá mềm (chỉ Student/Subject/TeachingSession/Payment) nên bỏ `isDeleted` ở `student` là đủ. Lần thu ở Thùng rác đã bị trừ khỏi `paidAmount` bởi `syncPaidAmount` từ Q.

- [ ] **Step 6: Viết lại test Q cũ** — `tests/integration/soft-delete-tuition.test.ts`, test `"xoá HS → biến khỏi học phí, báo cáo tháng, sao lưu; ghi tiền cho HS đã xoá → NOT_FOUND"`:

Đổi tên test thành `"xoá HS (đã nghỉ, hết nợ) → biến khỏi học phí + sao lưu, Báo cáo vẫn giữ tiền; ghi tiền cho HS đã xoá → NOT_FOUND"` và thay đoạn từ `await caller.student.delete({ id: st.id })` tới hết `expect(sum)…` bằng:
```ts
    // R2: HS có dữ liệu phải Đã nghỉ + hết nợ (đã thu 40.000 / phí 100.000 → trả nốt 60.000).
    await caller.payment.create({ studentId: st.id, year: Y, month: M, amount: 60_000, paidAt: "2030-05-21", method: "cash" })
    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })

    expect(await row(caller, st.id)).toBeUndefined()
    const sum = await caller.report.monthlySummary({ year: Y, month: M })
    // R8: tiền đã thu + học phí đã dạy của HS đã xoá vẫn tính.
    expect(sum).toMatchObject({ totalRevenue: 100_000, totalPaid: 100_000, totalStudents: 1 })
```
Giữ nguyên phần `payment.create … NOT_FOUND` (đổi `paidAt` sang `"2030-05-22"` nếu trùng) và phần sao lưu.

- [ ] **Step 7: Chạy**

Run: `pnpm test tests/integration/report-deleted-students.test.ts tests/integration/soft-delete-tuition.test.ts tests/integration/report.test.ts tests/integration/dashboard-alerts.test.ts tests/integration/tuition-report-consistency.test.ts`
Expected: PASS hết. (Tên file report có thể khác — chạy `ls tests/integration | grep -i report` và chạy đủ.)

- [ ] **Step 8: Commit**

```bash
git add src/server/soft-delete.ts src/server/services/report.service.ts tests/integration/report-deleted-students.test.ts tests/integration/soft-delete-tuition.test.ts
git commit -m "feat(r): Báo cáo và Tổng quan tính cả tiền, buổi học của học sinh đã xoá"
```

---

### Task 4: Dọn Thùng rác (server)

**Files:**
- Create: `src/server/services/trash-purge.service.ts`
- Modify: `src/server/services/trash.service.ts`
- Modify: `src/lib/schemas/trash.ts`
- Modify: `src/server/trpc/routers/trash.ts`
- Test: `tests/integration/trash-purge.test.ts`

**Interfaces:**
- Consumes: `Student.purgedAt`, `Subject.purgedAt` (Task 1); quy tắc xoá (Task 2).
- Produces:
  ```ts
  export const trashPurgeSchema = z.object({ type: z.enum(TRASH_TYPES) })
  export type TrashPurgeInput = z.infer<typeof trashPurgeSchema>
  export const DELETED_STUDENT_NAME = "Học sinh đã xoá"
  export async function purgeTrash(db: PrismaClient, userId: number, type: TrashType): Promise<number>
  export async function purgeAllTrash(db: PrismaClient, userId: number): Promise<{ purged: Record<TrashType, number> }>
  ```
  tRPC: `trash.purge({ type })` → `{ purged: Record<TrashType, number> }` (chỉ loại đó khác 0), `trash.purgeAll()` → cùng kiểu.

- [ ] **Step 1: Viết test (đỏ)** — `tests/integration/trash-purge.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getParentView } from "@/server/services/parent-link.service"
import { getAuthedCaller } from "../helpers/trpc"

const D = "2031-04-07"
const TOKEN = "r".repeat(43)

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany({ where: { name: { not: "Tiếng Anh" } } })
}

async function subjectId(caller: Awaited<ReturnType<typeof getAuthedCaller>>) {
  return (await caller.subject.list({})).find((s) => s.isDefault)!.id
}

describe("Dọn Thùng rác (spec R4–R7)", () => {
  beforeEach(clean)

  it("dọn ca: xoá cứng ca + link, ca sống không đụng", async () => {
    const caller = await getAuthedCaller()
    const sid = await subjectId(caller)
    const st = await caller.student.create({ fullName: "HS Ca", grade: 3 })
    const a = await caller.session.create({ sessionDate: D, startTime: "08:00", endTime: "09:00", subjectId: sid, studentIds: [st.id] })
    const b = await caller.session.create({ sessionDate: D, startTime: "10:00", endTime: "11:00", subjectId: sid })
    await caller.session.delete({ id: a.id })
    expect(await caller.trash.purge({ type: "session" })).toEqual({ purged: { session: 1, student: 0, payment: 0, subject: 0 } })
    expect(await db.teachingSession.findUnique({ where: { id: a.id, isDeleted: undefined } })).toBeNull()
    expect(await db.sessionStudent.count({ where: { sessionId: a.id } })).toBe(0)
    expect(await db.teachingSession.findUnique({ where: { id: b.id } })).not.toBeNull()
  })

  it("dọn lần thu: xoá cứng, paidAmount không đổi", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Thu", grade: 6 })
    await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 50_000, paidAt: "2030-05-20", method: "cash" })
    const p = await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 20_000, paidAt: "2030-05-21", method: "cash" })
    await caller.payment.delete({ id: p.id })
    await caller.trash.purge({ type: "payment" })
    expect(await db.payment.findUnique({ where: { id: p.id, isDeleted: undefined } })).toBeNull()
    const mt = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId: st.id, year: 2030, month: 5 } } })
    expect(mt.paidAmount).toBe(50_000)
  })

  it("dọn HS: ẩn danh, giữ lần thu/học phí/điểm danh, link phụ huynh chết, không còn trong Thùng rác, khôi phục → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const sid = await subjectId(caller)
    const st = await caller.student.create({ fullName: "HS Ẩn", grade: 6, tuitionFee: 80_000, parentPhone: "0901234567", parentName: "Chị Ẩn", notes: "ghi chú" })
    const s = await caller.session.create({ sessionDate: "2030-05-06", startTime: "08:00", endTime: "09:00", subjectId: sid, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 80_000, paidAt: "2030-05-20", method: "cash" })
    await db.student.update({ where: { id: st.id }, data: { parentLinkToken: TOKEN } })
    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })

    expect(await caller.trash.purge({ type: "student" })).toMatchObject({ purged: { student: 1 } })
    const row = await db.student.findUniqueOrThrow({ where: { id: st.id, isDeleted: true } })
    expect(row).toMatchObject({ fullName: "Học sinh đã xoá", parentPhone: null, parentName: null, notes: null, parentLinkToken: null })
    expect(row.purgedAt).toBeInstanceOf(Date)
    expect(await db.payment.count({ where: { monthlyTuition: { studentId: st.id } } })).toBe(1)
    expect(await db.sessionStudent.count({ where: { studentId: st.id } })).toBe(1)
    expect(await getParentView(db, TOKEN, "2030-05")).toBeNull()
    expect(await caller.trash.counts()).toMatchObject({ student: 0 })
    expect((await caller.trash.list({ type: "student" })).totalCount).toBe(0)
    await expect(caller.trash.restore({ type: "student", id: st.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("dọn môn: không còn ca → mất hẳn; còn ca đã xoá → purgedAt, biến khỏi Thùng rác", async () => {
    const caller = await getAuthedCaller()
    const ly = await caller.subject.create({ name: "Lý", color: "#D97706" })
    const hoa = await caller.subject.create({ name: "Hoá", color: "#16A34A" })
    const s = await caller.session.create({ sessionDate: D, startTime: "13:00", endTime: "14:00", subjectId: hoa.id })
    await caller.session.delete({ id: s.id })
    await caller.subject.delete({ id: ly.id })
    await caller.subject.delete({ id: hoa.id })

    expect(await caller.trash.purge({ type: "subject" })).toMatchObject({ purged: { subject: 2 } })
    expect(await db.subject.findUnique({ where: { id: ly.id, isDeleted: undefined } })).toBeNull()
    const h = await db.subject.findUniqueOrThrow({ where: { id: hoa.id, isDeleted: true } })
    expect(h.purgedAt).toBeInstanceOf(Date)
    expect(await caller.trash.counts()).toMatchObject({ subject: 0 })
    await expect(caller.trash.restore({ type: "subject", id: hoa.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("dọn sạch: cả 4 loại; dọn lần 2 → 0", async () => {
    const caller = await getAuthedCaller()
    const sid = await subjectId(caller)
    const st = await caller.student.create({ fullName: "HS Sạch", grade: 3 })
    const s = await caller.session.create({ sessionDate: D, startTime: "15:00", endTime: "16:00", subjectId: sid })
    const ly = await caller.subject.create({ name: "Lý", color: "#D97706" })
    await caller.session.delete({ id: s.id })
    await caller.student.delete({ id: st.id })
    await caller.subject.delete({ id: ly.id })

    expect(await caller.trash.purgeAll()).toEqual({ purged: { session: 1, student: 1, payment: 0, subject: 1 } })
    expect(await caller.trash.counts()).toEqual({ session: 0, student: 0, payment: 0, subject: 0 })
    expect(await caller.trash.purgeAll()).toEqual({ purged: { session: 0, student: 0, payment: 0, subject: 0 } })
  })

  it("chỉ dọn của mình", async () => {
    const caller = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const st = await caller.student.create({ fullName: "HS Riêng", grade: 3 })
    await caller.student.delete({ id: st.id })
    expect(await other.trash.purgeAll()).toMatchObject({ purged: { student: 0 } })
    expect(await caller.trash.counts()).toMatchObject({ student: 1 })
  })
})
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm test tests/integration/trash-purge.test.ts`
Expected: FAIL — `trash.purge` không tồn tại.

- [ ] **Step 3: Schema** — `src/lib/schemas/trash.ts`, thêm cuối file:

```ts
export const trashPurgeSchema = z.object({ type: z.enum(TRASH_TYPES) })
export type TrashPurgeInput = z.infer<typeof trashPurgeSchema>
```

- [ ] **Step 4: Service** — tạo `src/server/services/trash-purge.service.ts`

```ts
import type { PrismaClient } from "@prisma/client"
import type { TrashType } from "@/lib/schemas/trash"
import { TX_OPTIONS } from "./payment.service"

export const DELETED_STUDENT_NAME = "Học sinh đã xoá"
const PURGE_ORDER: TrashType[] = ["payment", "session", "student", "subject"]

// Dọn vĩnh viễn 1 loại (spec R5–R7). Chỉ bản isDeleted của userId, bỏ bản đã dọn (purgedAt).
export async function purgeTrash(db: PrismaClient, userId: number, type: TrashType): Promise<number> {
  const now = new Date()
  const n = await db.$transaction(async (tx) => {
    if (type === "payment") {
      const r = await tx.payment.deleteMany({ where: { isDeleted: true, monthlyTuition: { student: { userId } } } })
      return r.count
    }
    if (type === "session") {
      const r = await tx.teachingSession.deleteMany({ where: { userId, isDeleted: true } })
      return r.count
    }
    if (type === "student") {
      // Ẩn danh thay vì xoá cứng: giữ lần thu/học phí/điểm danh để doanh thu không hụt (spec R5).
      const r = await tx.student.updateMany({
        where: { userId, isDeleted: true, purgedAt: null },
        data: { fullName: DELETED_STUDENT_NAME, parentPhone: null, parentName: null, notes: null, parentLinkToken: null, purgedAt: now },
      })
      return r.count
    }
    // Môn còn ca (kể cả ca đã xoá) không xoá cứng được vì khoá ngoại → chỉ ẩn vĩnh viễn.
    const free = await tx.subject.deleteMany({ where: { userId, isDeleted: true, purgedAt: null, sessions: { none: {} } } })
    const kept = await tx.subject.updateMany({ where: { userId, isDeleted: true, purgedAt: null }, data: { purgedAt: now } })
    return free.count + kept.count
  }, TX_OPTIONS)
  console.info(`[trash] user ${userId} dọn ${type}: ${n}`)
  return n
}

export async function purgeAllTrash(db: PrismaClient, userId: number): Promise<{ purged: Record<TrashType, number> }> {
  const purged = { session: 0, student: 0, payment: 0, subject: 0 }
  for (const type of PURGE_ORDER) purged[type] = await purgeTrash(db, userId, type)
  return { purged }
}
```

> Extension xoá mềm: `deleteMany`/`updateMany` không nằm trong `READ_OPS` nên không bị thêm `isDeleted: false`; `sessions: { none: {} }` là quan hệ lồng nên extension không đụng → đếm cả ca đã xoá (đúng ý). Nếu `TX_OPTIONS` không export từ `payment.service` → bỏ tham số thứ 2, ghi Ruling.

- [ ] **Step 5: `trash.service.ts` bỏ bản đã dọn**

1. `getTrashCounts`: `db.student.count({ where: { userId, ...DELETED } })` → `where: { userId, ...DELETED, purgedAt: null }`; tương tự `db.subject.count`.
2. `listTrash`: nhánh `student` và nhánh `subject`: `const where = { userId, ...DELETED }` → `{ userId, ...DELETED, purgedAt: null }`.
3. `undeleteStudent`: `findUnique({ where: { id, ...DELETED } })` → `where: { id, ...DELETED, purgedAt: null }`; tương tự `undeleteSubject`.

- [ ] **Step 6: Router** — `src/server/trpc/routers/trash.ts`

```ts
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { trashListSchema, trashPurgeSchema, trashRestoreSchema } from "@/lib/schemas/trash"
import { getTrashCounts, listTrash, restoreTrashItem } from "@/server/services/trash.service"
import { purgeAllTrash, purgeTrash } from "@/server/services/trash-purge.service"

// Mọi gói đều dùng được (spec Q Q12, R4).
export const trashRouter = createTRPCRouter({
  counts: protectedProcedure.query(({ ctx }) => getTrashCounts(ctx.db, ctx.userId)),
  list: protectedProcedure.input(trashListSchema).query(({ ctx, input }) => listTrash(ctx.db, ctx.userId, input)),
  restore: protectedProcedure.input(trashRestoreSchema).mutation(({ ctx, input }) => restoreTrashItem(ctx.db, ctx.userId, input)),
  purge: protectedProcedure.input(trashPurgeSchema).mutation(async ({ ctx, input }) => {
    const purged = { session: 0, student: 0, payment: 0, subject: 0 }
    purged[input.type] = await purgeTrash(ctx.db, ctx.userId, input.type)
    return { purged }
  }),
  purgeAll: protectedProcedure.mutation(({ ctx }) => purgeAllTrash(ctx.db, ctx.userId)),
})
```

- [ ] **Step 7: Chạy**

Run: `pnpm test tests/integration/trash-purge.test.ts tests/integration/trash.test.ts tests/unit/schemas/trash.schema.test.ts`
Expected: PASS hết.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/trash-purge.service.ts src/server/services/trash.service.ts src/lib/schemas/trash.ts src/server/trpc/routers/trash.ts tests/integration/trash-purge.test.ts
git commit -m "feat(r): dọn Thùng rác vĩnh viễn (ca, lần thu xoá cứng; học sinh ẩn danh giữ tiền; môn xoá hoặc ẩn)"
```

---

### Task 5: UI học sinh — menu "Đã nghỉ / Học lại / Xóa", hộp thoại Xóa mới

**Files:**
- Rewrite: `src/components/students/DeleteStudentDialog.tsx`
- Modify: `src/components/students/StudentList.tsx` (menu `actionsMenu`, hộp thoại Đã nghỉ, mutation Học lại)
- Modify: `src/language/vi.json`, `src/language/en.json`
- Rewrite: `tests/unit/components/DeleteStudentDialog.test.tsx`
- Create: `tests/unit/components/StudentActionsMenu.test.tsx`
- Modify: `tests/e2e/trash.spec.ts` (test 4 + `afterEach`)

**Interfaces:**
- Consumes: `trpc.student.deleteCheck.useQuery({ id })` → `DeleteCheck` (Task 2); `trpc.student.update` input `{ id, data: { isActive: true } }` (sẵn có).

- [ ] **Step 1: i18n** — sửa/thêm trong `src/language/vi.json` (giữ thứ tự gần key cũ), và **xoá** `deactivate_instead`, `delete_student_debt_desc`:

```json
  "deactivate": "Đã nghỉ",
  "deactivate_student": "Đánh dấu học sinh đã nghỉ?",
  "deactivate_student_desc": "chuyển sang Đã nghỉ và được gỡ khỏi các ca chưa dạy. Học phí, nợ và lịch sử vẫn giữ.",
  "deactivate_success": "Đã chuyển học sinh sang Đã nghỉ",
  "mark_dropped_hint": "Đã nghỉ hoặc sắp nghỉ. Giữ học phí, nợ, lịch sử; gỡ khỏi các ca sắp tới.",
  "mark_back": "Học lại",
  "mark_back_hint": "Chuyển về Đang học. Không tự thêm lại vào các ca.",
  "mark_back_success": "Đã chuyển học sinh về Đang học",
  "delete_student_menu": "Xóa học sinh",
  "delete_student_hint": "Chỉ dùng khi nhập nhầm hoặc trùng.",
  "delete_student_desc": "sẽ vào Thùng rác, khôi phục được. Tiền đã thu vẫn được giữ trong Báo cáo.",
  "delete_blocked_active": "Không xóa được: {name} đang học và đã có buổi học hoặc lần thu. Nếu học sinh đã nghỉ, hãy chọn Đã nghỉ trong menu.",
  "delete_blocked_debt": "Không xóa được: {name} còn nợ {amount}. Thu hết nợ trước khi xóa.",
  "close": "Đóng",
```
`src/language/en.json` cùng key:
```json
  "deactivate": "Mark as dropped",
  "deactivate_student": "Mark student as dropped?",
  "deactivate_student_desc": "will be marked as dropped and removed from upcoming sessions. Tuition, debt and history are kept.",
  "deactivate_success": "Student marked as dropped",
  "mark_dropped_hint": "Dropped or about to drop. Keeps tuition, debt, history; removed from upcoming sessions.",
  "mark_back": "Back to studying",
  "mark_back_hint": "Set back to Studying. Not re-added to sessions automatically.",
  "mark_back_success": "Student is studying again",
  "delete_student_menu": "Delete student",
  "delete_student_hint": "Only for mistaken or duplicate entries.",
  "delete_student_desc": "will be moved to Trash and can be restored. Collected payments stay in Reports.",
  "delete_blocked_active": "Cannot delete: {name} is studying and already has lessons or payments. If the student has dropped, choose Mark as dropped in the menu.",
  "delete_blocked_debt": "Cannot delete: {name} still owes {amount}. Collect the debt before deleting.",
  "close": "Close",
```
Kiểm: `node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k)))"` → `[] []`. `grep -rn "deactivate_instead\|delete_student_debt_desc" src tests` → chỉ còn trong test sắp viết lại (không còn trong `src`).

- [ ] **Step 2: Viết lại test hộp thoại (đỏ)** — `tests/unit/components/DeleteStudentDialog.test.tsx`

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DeleteStudentDialog } from "@/components/students/DeleteStudentDialog"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const q = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}))
const del = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ student: { list: { invalidate: vi.fn() } }, trash: { counts: { invalidate: vi.fn() } } }),
    student: {
      deleteCheck: { useQuery: () => q },
      delete: { useMutation: () => del },
    },
  },
}))

const student = { id: 7, fullName: "QA Trần Thị Bình", isActive: true }
const renderIt = () =>
  render(
    <LanguageProvider>
      <DeleteStudentDialog student={student} onOpenChange={() => {}} />
    </LanguageProvider>
  )

describe("DeleteStudentDialog (spec R mục 3)", () => {
  beforeEach(() => {
    q.data = undefined
    q.isPending = false
    q.isError = false
    del.mutate.mockReset()
  })

  it("đang kiểm → nút Xóa disabled, chữ Đang kiểm tra", () => {
    q.isPending = true
    renderIt()
    expect(screen.getByRole("button", { name: /Đang kiểm tra/ })).toBeDisabled()
  })

  it("allowed → mô tả Thùng rác + giữ tiền, bấm Xóa gọi delete", () => {
    q.data = { allowed: true }
    renderIt()
    expect(screen.getByText(/Tiền đã thu vẫn được giữ trong Báo cáo/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))
    expect(del.mutate).toHaveBeenCalledWith({ id: 7 })
  })

  it("active_with_data → báo không xóa được, chỉ nút Đóng", () => {
    q.data = { allowed: false, reason: "active_with_data" }
    renderIt()
    expect(screen.getByText(/đang học và đã có buổi học hoặc lần thu/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Đóng" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull()
  })

  it("debt → báo còn nợ đúng số, chỉ nút Đóng", () => {
    q.data = { allowed: false, reason: "debt", debt: 2_250_000 }
    renderIt()
    expect(screen.getByText(/còn nợ 2\.250\.000/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull()
  })

  it("không còn nút Cho nghỉ thay", () => {
    q.data = { allowed: false, reason: "debt", debt: 100_000 }
    renderIt()
    expect(screen.queryByRole("button", { name: /nghỉ thay/i })).toBeNull()
  })

  it("lỗi tải → nút Thử lại gọi refetch", () => {
    q.isError = true
    renderIt()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(q.refetch).toHaveBeenCalled()
  })
})
```

Run: `pnpm test tests/unit/components/DeleteStudentDialog.test.tsx` → FAIL (component cũ gọi `tuition.getMonthlyStatusReadOnly`, không có "Đóng").

- [ ] **Step 3: Viết lại `DeleteStudentDialog.tsx`**

```tsx
"use client"

import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"

type Props = {
  student: { id: number; fullName: string; isActive: boolean }
  onOpenChange: (open: boolean) => void
}

// Server là nguồn sự thật của quy tắc xoá (spec R2); dialog chỉ hiện kết quả.
export function DeleteStudentDialog({ student, onOpenChange }: Props) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const check = trpc.student.deleteCheck.useQuery({ id: student.id })
  const close = () => onOpenChange(false)
  const del = trpc.student.delete.useMutation({
    onSuccess: () => {
      toast.success(t("delete_success"))
      utils.student.list.invalidate()
      utils.trash.counts.invalidate()
      close()
    },
    onError: (e) => toast.error(e.message),
  })

  const result = check.data
  const blocked = result && !result.allowed
  const message = check.isError
    ? t("load_error")
    : !result
      ? null
      : result.allowed
        ? null
        : result.reason === "debt"
          ? t("delete_blocked_debt").replace("{name}", student.fullName).replace("{amount}", formatCurrency(result.debt))
          : t("delete_blocked_active").replace("{name}", student.fullName)

  return (
    <AlertDialog open onOpenChange={(o) => !del.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete_student")}</AlertDialogTitle>
          <AlertDialogDescription>
            {message ?? (
              <>
                <strong className="text-slate-900">{student.fullName}</strong> {t("delete_student_desc")}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          {check.isError ? (
            <Button type="button" variant="outline" className="h-11 md:h-10" onClick={() => check.refetch()}>
              {t("retry")}
            </Button>
          ) : null}
          <AlertDialogCancel className="h-11 md:h-10" disabled={del.isPending}>
            {blocked || check.isError ? t("close") : t("cancel")}
          </AlertDialogCancel>
          {!blocked && !check.isError && (
            <Button
              type="button"
              className="h-11 bg-red-600 hover:bg-red-700 md:h-10"
              disabled={check.isPending || del.isPending}
              onClick={() => del.mutate({ id: student.id })}
            >
              {check.isPending ? t("checking") : del.isPending ? t("deleting") : t("delete")}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```
> Nếu `StudentList` đã tự invalidate `student.list` khi đóng dialog (xem chỗ render `<DeleteStudentDialog … onOpenChange={…}>` dòng ~357) thì giữ cả hai — invalidate thừa không hại. Nếu `trpc.useUtils().trash` không có kiểu → bỏ dòng `trash.counts`, ghi Ruling.

Run: `pnpm test tests/unit/components/DeleteStudentDialog.test.tsx` → PASS 6/6.

- [ ] **Step 4: Test menu (đỏ)** — tạo `tests/unit/components/StudentActionsMenu.test.tsx`

Tách menu trong `StudentList` ra component con để test được: `src/components/students/StudentActionsMenu.tsx` (Step 5). Test:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { StudentActionsMenu } from "@/components/students/StudentActionsMenu"

function setup(isActive: boolean) {
  const h = {
    onViewSchedule: vi.fn(),
    onParentLink: vi.fn(),
    onEdit: vi.fn(),
    onMarkDropped: vi.fn(),
    onMarkBack: vi.fn(),
    onDelete: vi.fn(),
  }
  render(
    <LanguageProvider>
      <StudentActionsMenu isActive={isActive} parentLinkLocked={false} {...h} />
    </LanguageProvider>
  )
  return h
}

describe("StudentActionsMenu (spec R mục 3)", () => {
  it("HS đang học: có Đã nghỉ (kèm mô tả), không có Học lại, có Xóa học sinh + mô tả", async () => {
    const h = setup(true)
    await userEvent.click(screen.getByRole("button", { name: "Menu hành động" }))
    expect(screen.getByRole("menuitem", { name: /Đã nghỉ.*Giữ học phí/ })).toBeTruthy()
    expect(screen.queryByRole("menuitem", { name: /Học lại/ })).toBeNull()
    const del = screen.getByRole("menuitem", { name: /Xóa học sinh.*nhập nhầm/ })
    fireEvent.click(del)
    expect(h.onDelete).toHaveBeenCalled()
  })

  it("HS đã nghỉ: có Học lại, không có Đã nghỉ", async () => {
    const h = setup(false)
    await userEvent.click(screen.getByRole("button", { name: "Menu hành động" }))
    expect(screen.queryByRole("menuitem", { name: /^Đã nghỉ/ })).toBeNull()
    fireEvent.click(screen.getByRole("menuitem", { name: /Học lại/ }))
    expect(h.onMarkBack).toHaveBeenCalled()
  })
})
```
> Nhãn nút "Menu hành động" là giá trị hiện tại của `t("actions")` (e2e cũ dùng tên này). Nếu `@testing-library/user-event` chưa có trong `package.json` → dùng `fireEvent.pointerDown(btn, { button: 0, ctrlKey: false })` + `fireEvent.click` như test Radix khác trong repo (tìm `pointerDown` trong `tests/unit`), ghi Ruling; KHÔNG cài package mới.

Run: `pnpm test tests/unit/components/StudentActionsMenu.test.tsx` → FAIL (không resolve `StudentActionsMenu`).

- [ ] **Step 5: Tạo `src/components/students/StudentActionsMenu.tsx`**

```tsx
"use client"

import type { ReactNode } from "react"
import { CalendarDays, Link2, MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  isActive: boolean
  parentLinkLocked: boolean
  parentLinkBadge?: ReactNode
  onViewSchedule: () => void
  onParentLink: () => void
  onEdit: () => void
  onMarkDropped: () => void
  onMarkBack: () => void
  onDelete: () => void
}

// Mục có dòng mô tả để giáo viên phân biệt Đã nghỉ và Xóa (spec R1).
function TwoLine({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span>{title}</span>
      <span className="text-xs font-normal text-slate-500">{hint}</span>
    </span>
  )
}

export function StudentActionsMenu(p: Props) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={t("actions")}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={p.onViewSchedule}>
          <CalendarDays className="mr-2 size-4" />
          {t("view_schedule")}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={p.onParentLink}>
          <Link2 className="mr-2 size-4" />
          {t("parent_link")}
          {p.parentLinkBadge}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={p.onEdit}>
          <Pencil className="mr-2 size-4" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {p.isActive ? (
          <DropdownMenuItem className="min-h-11 items-start" onSelect={p.onMarkDropped}>
            <UserX className="mr-2 mt-0.5 size-4 shrink-0" />
            <TwoLine title={t("deactivate")} hint={t("mark_dropped_hint")} />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-11 items-start" onSelect={p.onMarkBack}>
            <UserCheck className="mr-2 mt-0.5 size-4 shrink-0" />
            <TwoLine title={t("mark_back")} hint={t("mark_back_hint")} />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="min-h-11 items-start text-red-600 focus:text-red-700" onSelect={p.onDelete}>
          <Trash2 className="mr-2 mt-0.5 size-4 shrink-0" />
          <TwoLine title={t("delete_student_menu")} hint={t("delete_student_hint")} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```
> `DropdownMenuSeparator` có trong `@/components/ui/dropdown-menu` của shadcn; nếu file không export → bỏ separator, ghi Ruling. Prop `parentLinkLocked` giữ để `StudentList` truyền trạng thái khoá (logic mở upgrade vẫn ở `onParentLink` phía `StudentList`).

- [ ] **Step 6: `StudentList.tsx` dùng menu mới + Học lại**

1. Import `StudentActionsMenu`; thay toàn bộ hàm `actionsMenu` bằng:
```tsx
  const actionsMenu = (s: StudentRow) => (
    <StudentActionsMenu
      isActive={s.isActive}
      parentLinkLocked={linkGate.locked}
      parentLinkBadge={linkGate.locked ? <LockBadge plan={linkGate.requiredPlan} className="ml-auto pl-2" /> : undefined}
      onViewSchedule={() => router.push(`/calendar?studentId=${s.id}`)}
      onParentLink={() => (linkGate.locked && !s.parentLinkToken ? linkGate.openUpgrade() : setParentLinkTarget(s))}
      onEdit={() => setFormState({ open: true, mode: "edit", student: s })}
      onMarkDropped={() => setDeactivateTarget(s)}
      onMarkBack={() => markBackMut.mutate({ id: s.id, data: { isActive: true } })}
      onDelete={() => setDeleteTarget(s)}
    />
  )
```
2. Cạnh `deactivateMut` thêm:
```tsx
  const markBackMut = trpc.student.update.useMutation({
    onSuccess: () => {
      toast.success(t("mark_back_success"))
      utils.student.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
```
3. Xoá các import icon/Dropdown không còn dùng trong `StudentList` (tsc/lint sẽ báo). Hộp thoại "Đã nghỉ" giữ nguyên cấu trúc — chữ đổi qua i18n Step 1.
4. Chỗ `<DeleteStudentDialog>` giữ nguyên props.

Run: `pnpm test tests/unit/components/StudentActionsMenu.test.tsx tests/unit/components/DeleteStudentDialog.test.tsx` → PASS. `pnpm exec tsc --noEmit` + `pnpm lint` sạch.

- [ ] **Step 7: Sửa e2e `tests/e2e/trash.spec.ts`**

a) `afterEach`: xoá ca trước (đã đúng thứ tự), sau đó với mỗi HS gọi `student.deactivate` rồi `student.delete` trong `try {}` (HS có buổi có mặt chỉ ở ca đã xoá → không còn dữ liệu, xoá được):
```ts
    for (const id of createdStudentIds.splice(0)) {
      try { await trpcMutation(page, 'student.deactivate', { id }); } catch {}
      try { await trpcMutation(page, 'student.delete', { id }); } catch {}
    }
```
b) Thay test 4 bằng:
```ts
  test('4. HS có dữ liệu: đang học → không xóa được; Đã nghỉ còn nợ → không xóa được; không có nút Cho nghỉ thay', async ({ page }) => {
    const stamp = Math.floor(Math.random() * 100_000);
    const nameDebt = `E2E Nợ ${stamp}`;
    const subjectId = await getDefaultSubjectId(page);
    const st = await trpcMutation<{ id: number }>(page, 'student.create', { fullName: nameDebt, grade: 6, tuitionFee: 100_000 });
    createdStudentIds.push(st.id);
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const vnMonthDay = `${vnNow.toISOString().slice(0, 7)}-03`;
    const h = String(Math.floor(Math.random() * 8) + 6).padStart(2, '0');
    const sess = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: vnMonthDay, startTime: `${h}:00`, endTime: `${h}:45`, subjectId, studentIds: [st.id],
    });
    createdSessionIds.push(sess.id);
    await trpcMutation(page, 'attendance.update', { sessionId: sess.id, attendances: [{ studentId: st.id, attendance: 'present', fee: 100_000 }] });

    await page.goto('/students');
    const row = page.locator('tr', { hasText: nameDebt });
    await row.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/đang học và đã có buổi học hoặc lần thu/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /nghỉ thay/i })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Xóa' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Đóng' }).click();

    // Đánh dấu Đã nghỉ qua menu
    await row.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Đã nghỉ/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Đã nghỉ' }).click();
    await expect(page.getByText('Đã chuyển học sinh sang Đã nghỉ')).toBeVisible();

    await page.click('button:has-text("Đang học")');
    await page.getByRole('option', { name: 'Đã nghỉ' }).click();
    const rowInactive = page.locator('tr', { hasText: nameDebt });
    await rowInactive.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: /Xóa học sinh/ }).click();
    const dialog2 = page.getByRole('alertdialog');
    await expect(dialog2.getByText(/còn nợ 100\.000/)).toBeVisible();
    await expect(dialog2.getByRole('button', { name: 'Xóa' })).toHaveCount(0);
  });
```
c) Các test khác trong file dùng `getByRole('menuitem', { name: 'Xóa', exact: true })` → đổi thành `{ name: /Xóa học sinh/ }`; HS của các test đó phải "sạch" (không điểm danh có mặt / không lần thu) — nếu test tạo dữ liệu rồi xoá, thêm `student.deactivate` và trả hết nợ trước (qua `trpcMutation`), ghi Ruling. Tìm thêm ở các e2e khác: `grep -rn "menuitem.*Xóa\|Cho nghỉ" tests/e2e` và sửa cùng kiểu.

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` (seed) rồi `pnpm exec playwright test tests/e2e/trash.spec.ts tests/e2e/students.spec.ts tests/e2e/mobile.spec.ts` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/students/DeleteStudentDialog.tsx src/components/students/StudentActionsMenu.tsx src/components/students/StudentList.tsx src/language/vi.json src/language/en.json tests/unit/components/DeleteStudentDialog.test.tsx tests/unit/components/StudentActionsMenu.test.tsx tests/e2e/trash.spec.ts
git commit -m "feat(r): menu học sinh Đã nghỉ / Học lại / Xóa có mô tả; hộp thoại Xóa báo rõ lý do, bỏ nút Cho nghỉ thay"
```
(thêm file e2e khác nếu đã sửa ở Step 7c.)

---

### Task 6: UI Thùng rác — Dọn tab / Dọn sạch, popup cảnh báo, phân trang

**Files:**
- Create: `src/components/trash/PurgeDialog.tsx`
- Modify: `src/components/trash/TrashList.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Modify: `tests/unit/components/TrashList.test.tsx`
- Create: `tests/e2e/trash-purge.spec.ts`

**Interfaces:**
- Consumes: `trpc.trash.purge.useMutation()` input `{ type: TrashType }`, `trpc.trash.purgeAll.useMutation()`; cả hai trả `{ purged: Record<TrashType, number> }` (Task 4).
- Produces: `PurgeDialog` props `{ open: boolean; count: number; typeLabel: string | null; isStudent: boolean; pending: boolean; onConfirm: () => void; onOpenChange: (o: boolean) => void }` (`typeLabel = null` → dọn sạch).

- [ ] **Step 1: i18n** — thêm vào `vi.json`:
```json
  "trash_hint": "Mục đã xoá nằm ở đây cho tới khi bạn khôi phục hoặc dọn.",
  "purge_all": "Dọn sạch thùng rác",
  "purge_tab": "Dọn tab này ({n})",
  "purge_title_all": "Xóa vĩnh viễn {n} mục?",
  "purge_title_tab": "Xóa vĩnh viễn {n} {type}?",
  "purge_warning": "Lưu ý: dữ liệu đã xóa khỏi Thùng rác sẽ vĩnh viễn không lấy lại được. Bạn chắc chắn muốn xóa?",
  "purge_student_note": "Tiền đã thu của học sinh vẫn được giữ trong Báo cáo.",
  "purge_confirm": "Xóa vĩnh viễn",
  "purge_success": "Đã dọn {n} mục",
```
(`trash_hint` là sửa key có sẵn.) `en.json`:
```json
  "trash_hint": "Deleted items stay here until you restore or empty them.",
  "purge_all": "Empty trash",
  "purge_tab": "Empty this tab ({n})",
  "purge_title_all": "Permanently delete {n} items?",
  "purge_title_tab": "Permanently delete {n} {type}?",
  "purge_warning": "Note: data removed from Trash can never be recovered. Are you sure you want to delete it?",
  "purge_student_note": "Payments already collected from these students stay in Reports.",
  "purge_confirm": "Delete permanently",
  "purge_success": "Emptied {n} items",
```
Kiểm parity như Task 5 Step 1 → `[] []`.

- [ ] **Step 2: Test (đỏ)** — thêm vào `tests/unit/components/TrashList.test.tsx`

Mở rộng mock `@/lib/trpc` sẵn có của file: thêm
```ts
const mockPurge = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
const mockPurgeAll = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
```
và trong object `trash` của mock: `purge: { useMutation: () => mockPurge }, purgeAll: { useMutation: () => mockPurgeAll }` (giữ nguyên các mock cũ). Thêm các test:
```tsx
  it("nút Dọn tab này có số mục của tab, bấm → popup cảnh báo, Xóa vĩnh viễn gọi purge đúng loại", () => {
    mockCounts.data = { session: 1, student: 0, payment: 2, subject: 0 }
    renderTrash()
    fireEvent.click(screen.getByRole("button", { name: "Dọn tab này (1)" }))
    expect(screen.getByText(/vĩnh viễn không lấy lại được/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))
    expect(mockPurge.mutate).toHaveBeenCalledWith({ type: "session" })
  })

  it("Dọn sạch thùng rác → popup tổng 3 mục → gọi purgeAll", () => {
    mockCounts.data = { session: 1, student: 0, payment: 2, subject: 0 }
    renderTrash()
    fireEvent.click(screen.getByRole("button", { name: "Dọn sạch thùng rác" }))
    expect(screen.getByText("Xóa vĩnh viễn 3 mục?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))
    expect(mockPurgeAll.mutate).toHaveBeenCalled()
  })

  it("thùng rác trống → 2 nút dọn disabled", () => {
    mockCounts.data = { session: 0, student: 0, payment: 0, subject: 0 }
    renderTrash()
    expect(screen.getByRole("button", { name: "Dọn sạch thùng rác" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Dọn tab này (0)" })).toBeDisabled()
  })

  it("tab Học sinh: popup có dòng tiền vẫn giữ trong Báo cáo", () => {
    mockCounts.data = { session: 0, student: 2, payment: 0, subject: 0 }
    renderTrash()
    fireEvent.click(screen.getByRole("tab", { name: /Học sinh/ }))
    fireEvent.click(screen.getByRole("button", { name: "Dọn tab này (2)" }))
    expect(screen.getByText(/vẫn được giữ trong Báo cáo/)).toBeTruthy()
  })
```
> `renderTrash` là hàm render sẵn có của file (nếu tên khác thì dùng tên thật). Reset `mockPurge.mutate`/`mockPurgeAll.mutate` trong `beforeEach` sẵn có.

Run: `pnpm test tests/unit/components/TrashList.test.tsx` → 4 test mới FAIL (không có nút dọn).

- [ ] **Step 3: `src/components/trash/PurgeDialog.tsx`**

```tsx
"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  open: boolean
  count: number
  typeLabel: string | null
  isStudent: boolean
  pending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function PurgeDialog({ open, count, typeLabel, isStudent, pending, onConfirm, onOpenChange }: Props) {
  const { t } = useTranslation()
  const title = typeLabel
    ? t("purge_title_tab").replace("{n}", String(count)).replace("{type}", typeLabel.toLowerCase())
    : t("purge_title_all").replace("{n}", String(count))
  return (
    // Đang dọn thì không cho đóng: tránh người dùng tưởng đã huỷ trong khi server vẫn xoá.
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{t("purge_warning")}</p>
              {isStudent && <p>{t("purge_student_note")}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-11 md:h-10" disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button type="button" className="h-11 bg-red-600 hover:bg-red-700 md:h-10" disabled={pending} onClick={onConfirm}>
            {pending ? t("processing") : t("purge_confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 4: `TrashList.tsx`**

1. Import `Trash2` từ `lucide-react`, `PurgeDialog`, `useEffect`.
2. State: `const [purgeTarget, setPurgeTarget] = useState<TrashType | "all" | null>(null)`.
3. Mutations (cạnh `restore`):
```tsx
  const afterPurge = (r: { purged: Record<TrashType, number> }) => {
    const n = Object.values(r.purged).reduce((a, b) => a + b, 0)
    toast.success(t("purge_success").replace("{n}", String(n)))
    setPurgeTarget(null)
    setPage(1)
    utils.trash.counts.invalidate()
    utils.trash.list.invalidate()
  }
  const purge = trpc.trash.purge.useMutation({ onSuccess: afterPurge, onError: (e) => toast.error(e.message) })
  const purgeAll = trpc.trash.purgeAll.useMutation({ onSuccess: afterPurge, onError: (e) => toast.error(e.message) })
  const total = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : 0
  const tabCount = counts.data?.[type] ?? 0
```
4. Lùi trang khi trang hiện tại vượt quá số trang (sửa minor Q):
```tsx
  const totalPages = list.data?.totalPages ?? 0
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages)
  }, [page, totalPages])
```
5. `PageHeader` thêm `actions`:
```tsx
      <PageHeader
        title={t("trash")}
        description={t("trash_hint")}
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 md:h-10"
            disabled={total === 0}
            onClick={() => setPurgeTarget("all")}
          >
            <Trash2 className="mr-2 size-4" />
            {t("purge_all")}
          </Button>
        }
      />
```
6. Bọc hàng chip bằng `<div className="flex flex-wrap items-center justify-between gap-2">` gồm `div role="tablist"` cũ + nút:
```tsx
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-red-600 hover:bg-red-50 hover:text-red-700 md:h-9"
          disabled={tabCount === 0}
          onClick={() => setPurgeTarget(type)}
        >
          {t("purge_tab").replace("{n}", String(tabCount))}
        </Button>
```
7. Phân trang: điều kiện `(list.data?.totalCount ?? 0) > pageSize` → `(list.data?.totalCount ?? 0) > 20`.
8. Cuối JSX (trước `</div>` ngoài cùng):
```tsx
      <PurgeDialog
        open={purgeTarget !== null}
        count={purgeTarget === "all" ? total : tabCount}
        typeLabel={purgeTarget === "all" || purgeTarget === null ? null : t(TYPE_KEY[purgeTarget])}
        isStudent={purgeTarget === "all" ? (counts.data?.student ?? 0) > 0 : purgeTarget === "student"}
        pending={purge.isPending || purgeAll.isPending}
        onConfirm={() => (purgeTarget === "all" ? purgeAll.mutate() : purgeTarget && purge.mutate({ type: purgeTarget }))}
        onOpenChange={(o) => !o && setPurgeTarget(null)}
      />
```

Run: `pnpm test tests/unit/components/TrashList.test.tsx` → PASS hết (cũ + 4 mới). `pnpm exec tsc --noEmit`, `pnpm lint` sạch.

- [ ] **Step 5: E2E (đỏ trước khi có UI thì đã qua; viết để khoá luồng)** — `tests/e2e/trash-purge.spec.ts`

```ts
import { test, expect, type Page } from '@playwright/test';

async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

for (const width of [1280, 390]) {
  test(`dọn tab Học sinh ở ${width}px: popup cảnh báo → HS biến khỏi Thùng rác`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    const name = `E2E Dọn ${width}-${Math.floor(Math.random() * 100_000)}`;
    const st = await trpcMutation<{ id: number }>(page, 'student.create', { fullName: name, grade: 3 });
    await trpcMutation(page, 'student.delete', { id: st.id });

    await page.goto('/trash');
    await page.getByRole('tab', { name: /Học sinh/ }).click();
    await expect(page.getByText(name)).toBeVisible();
    const purgeBtn = page.getByRole('button', { name: /Dọn tab này/ });
    const box = await purgeBtn.boundingBox();
    if (width === 390) expect(box!.height).toBeGreaterThanOrEqual(44);
    await purgeBtn.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/vĩnh viễn không lấy lại được/)).toBeVisible();
    await expect(dialog.getByText(/vẫn được giữ trong Báo cáo/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Xóa vĩnh viễn' }).click();
    await expect(page.getByText(/Đã dọn \d+ mục/)).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```
> Test dọn toàn bộ tab Học sinh của tài khoản `teacher` trên DB test — chấp nhận (DB test). Nếu test khác chạy song song phụ thuộc HS trong Thùng rác của `teacher` → chạy file này riêng.

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi `pnpm exec playwright test tests/e2e/trash-purge.spec.ts tests/e2e/trash.spec.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/trash/PurgeDialog.tsx src/components/trash/TrashList.tsx src/language/vi.json src/language/en.json tests/unit/components/TrashList.test.tsx tests/e2e/trash-purge.spec.ts
git commit -m "feat(r): Thùng rác có Dọn tab này / Dọn sạch với popup cảnh báo không lấy lại được; sửa phân trang"
```

---

### Task 7: Kiểm chứng cuối, version 0.7.0, báo cáo (không merge, không push)

**Files:**
- Modify: `package.json` (chỉ `"version"`)
- Chỉ sửa file của Task 1–6 nếu kiểm chứng phát hiện lỗi (mỗi sửa: test tái hiện → sửa → commit riêng `fix(r): …`).

- [ ] **Step 1: Xác nhận DB test** (lệnh Task 1 Step 2). Expected như đó.

- [ ] **Step 2: Quét sót**

```bash
grep -rn "deactivate_instead\|delete_student_debt_desc\|Cho nghỉ thay" src tests
grep -rn "LIVE_LINK" src/server/services/report.service.ts
grep -rn "purgedAt" src/server/services/trash.service.ts | wc -l
```
Expected: lệnh 1 không ra dòng nào; lệnh 2 chỉ còn ở `getStudentReport`/`getDashboardAlerts` (không ở `getMonthlySummary`/`getDashboardStats`); lệnh 3 ≥ 6.

- [ ] **Step 3: Nâng version**

`package.json` → `"version": "0.7.0"`.
```bash
git add package.json
git commit -m "chore(r): nâng version 0.7.0 (epoch 0.7, mọi người đăng nhập lại 1 lần khi R lên)"
```

- [ ] **Step 4: Toàn bộ kiểm thử**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test
```
Build (không dùng `pnpm build`): đặt `DATABASE_URL`/`DIRECT_URL` theo `.env.test` rồi `pnpm exec next build`.
Expected: tsc 0, lint 0, `pnpm test` toàn bộ PASS, e2e PASS (skip `upgrade-class` nếu DB test đã nâng lớp năm nay), build OK. Test `auth.spec.ts` kiểm epoch khớp `package.json` → phải PASS với 0.7.

- [ ] **Step 5: Báo cáo + kênh**

Ghi `.superpowers/gehihi/bao-cao-R.md`: nhánh, commit (SHA + message), kết quả từng lệnh ở Step 4, mọi dòng `Ruling:`, test đỏ ngoài phạm vi, và danh sách kiểm tay:
1. Vercel log có `Applying migration …_add_purged_at`.
2. Đăng nhập lại 1 lần (epoch 0.7), chân sidebar `v0.7.0`.
3. `qa_test`: menu HS thấy "Đã nghỉ"/"Học lại"/"Xóa học sinh" có mô tả; HS đang học có buổi học → Xóa báo không xóa được; HS mới tạo → Xóa được → vào Thùng rác → Dọn tab Học sinh → biến mất.
4. Báo cáo tháng có HS đã xoá (nếu có) vẫn giữ số Đã thu.
5. Mobile 390px: nút Dọn và menu HS không tràn, chạm được.

Rồi thêm vào `.superpowers/gehihi/kenh.md`:
`[YYYY-MM-DD HH:MM] GEHIHI → CLAUDE: DONE R — feat/r-da-nghi-thung-rac, HEAD <sha>, báo cáo: .superpowers/gehihi/bao-cao-R.md`
