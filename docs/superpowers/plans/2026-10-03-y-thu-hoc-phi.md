# Y — Luồng thu học phí mới Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thu học phí 1 chạm, trang phụ huynh 2 cột trên máy tính, modal link 4 nút 1 hàng, tiền tự trả tháng cũ nhất trước (FIFO) theo "đợt", mọi chỗ hiện tiền tách theo tháng, tháng đang học chỉ tạm tính, màn Học phí mặc định tháng trước, nhãn phiếu báo đếm ngày. Version `0.10.0`.

**Architecture:** Giữ mô hình chuỗi dư nợ (`MonthlyTuition` + `computeClosingBalances`). Thêm hàm thuần `allocatePayment` (`src/lib/payment-allocation.ts`) + loader `loadMonthLedgers` (tuition.service) → API mới `payment.record/deleteBatch/updateBatch/listBatches` tạo nhiều `Payment` cùng `batchId`. Hàm thuần `src/lib/tuition-display.ts` tính "cần đóng ngay / tạm tính / trạng thái" dùng chung cho server (lọc, phiếu báo) và client. UI: viết lại hành động ở danh sách `/tuition` và sheet chi tiết (bỏ checkbox + nút Lưu chung).

**Tech Stack:** Next.js 15, React 19, tRPC v11, React Query v5, Prisma 5.22 + PostgreSQL, zod, sonner, shadcn (Dialog/Sheet/AlertDialog/DropdownMenu), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-y-thu-hoc-phi-design.md` (D1–D10). Mockup: https://claude.ai/artifact/LUPXUqy91yJ78GjduEdgEy.

## Global Constraints

- Nhánh `feat/y-thu-hoc-phi` từ `main` **sau khi X (0.9.5) đã merge**. Version cuối `0.10.0`.
- **Migration duy nhất:** thêm `payments.batch_id VARCHAR(36)` + index. Tạo: `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name add_payment_batch`, đọc SQL, áp `... pnpm exec prisma migrate deploy` (kiểm dòng `localhost:5433`), `pnpm exec prisma generate`. Không áp prod. Prisma đòi reset/báo drift → DỪNG.
- An toàn DB: chỉ `.env.test`. Cấm `db:reset` / `migrate reset` / `db push` / `pnpm build` / `pnpm dev` / `git stash`. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu.
- **Giữ** `payment.create/update/delete` cũ (nhiều integration test dùng để dựng dữ liệu); chỉ đổi `method` thành optional mặc định `"cash"`. Giao diện không gọi chúng nữa (trừ sửa khoản thu cũ `legacy-*`).
- **Báo cáo "đã thu" không đổi định nghĩa** (tổng `paidAmount` theo tháng học phí).
- Không lọc/sắp DB theo trường mã hoá (`note`, `notes`, `fullName`…).
- "Tháng đang học" = `monthKey(year, month) >= monthKey(tháng hiện tại giờ VN)` (`vnDateParts`).
- i18n vi + en cùng bộ key; chuỗi mới không dùng gạch dài. Màu A3 (primary/slate/amber/đỏ nợ), không indigo/violet/purple. Vùng chạm ≥ 44px mobile.
- e2e: RAM ≥ 3000 MB, foreground, 2 nửa, dọn tiến trình node mình tạo sau mỗi lần test (LENH.md).
- Commit Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ledger `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/progress.md`.
- Sau Y merge, Claude (không phải agent) sửa plan W: version `0.11.0` + thêm mục `0.10.0` cho Y trong `RELEASES`.

## Review Focus

1. **Bấm "Đã đóng đủ" 2 lần nhanh / 2 tab cùng lúc**: không được trừ trùng 1 tháng; lần 2 thành trả trước (credit) ở tháng đang xem, không lỗi 500. Pin: Task 2 integration "2 lần record song song".
2. **Học sinh có tháng đã miễn (tất toán) xen giữa**: FIFO bỏ qua tháng đã miễn, không ghi tiền vào đó. Pin: Task 1 unit + Task 2 integration.
3. **Sửa đợt cũ (`legacy-*`, trước Y)**: sửa/xoá như cũ, không chia lại, không lỗi. Pin: Task 2 integration.
4. **Hoàn tác sau khi đã đóng sheet / chuyển trang**: vẫn xoá đúng đợt (callback cấp `useMutation` + client vanilla như U3). Pin: Task 4 component test.
5. **Tháng đang học học sinh trọn tháng**: cần đóng gồm cả tháng (không tạm tính); theo buổi thì không. Pin: Task 3 unit.

---

### Task 1: Migration `batch_id` + hàm chia tiền FIFO

**Files:**
- Modify: `prisma/schema.prisma` (model `Payment`)
- Create: `prisma/migrations/<ts>_add_payment_batch/migration.sql` (Prisma sinh), `src/lib/payment-allocation.ts`
- Test: `tests/unit/lib/payment-allocation.test.ts`

**Interfaces:**
- Produces: `type MonthLedger = { key: number; fee: number; paid: number; fullPaid: boolean }`; `allocatePayment(months: MonthLedger[], amount: number): { key: number; amount: number }[]`; `keyToYearMonth(key: number): { year: number; month: number }`. `Payment.batchId String?`.

- [ ] **Step 1: Schema + migration.** Model `Payment`, sau `note`:
```prisma
  // Các dòng tạo từ 1 lần thu (chia FIFO nhiều tháng) chung batchId; dòng trước Y = null (spec Y §3.3).
  batchId          String?        @map("batch_id") @db.VarChar(36)
```
và thêm `@@index([batchId])`. SQL mong đợi:
```sql
ALTER TABLE "payments" ADD COLUMN "batch_id" VARCHAR(36);
CREATE INDEX "payments_batch_id_idx" ON "payments"("batch_id");
```

- [ ] **Step 2: Test đỏ** — `tests/unit/lib/payment-allocation.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { allocatePayment, keyToYearMonth, type MonthLedger } from "@/lib/payment-allocation"
import { monthKey } from "@/lib/billing"

const k = (m: number) => monthKey(2026, m)
const L = (m: number, fee: number, paid = 0, fullPaid = false): MonthLedger => ({ key: k(m), fee, paid, fullPaid })

describe("allocatePayment (spec Y §3.2)", () => {
  it("trả tháng cũ nhất trước: nợ T8 200k + T9 600k, đưa 500k → T8 200k, T9 300k", () => {
    expect(allocatePayment([L(8, 200_000), L(9, 600_000)], 500_000)).toEqual([
      { key: k(8), amount: 200_000 }, { key: k(9), amount: 300_000 },
    ])
  })
  it("đóng đủ đúng số → không dư", () => {
    expect(allocatePayment([L(9, 800_000)], 800_000)).toEqual([{ key: k(9), amount: 800_000 }])
  })
  it("đóng dư → phần dư vào tháng cuối danh sách (tháng đang xem)", () => {
    expect(allocatePayment([L(9, 800_000), L(10, 300_000)], 1_200_000)).toEqual([
      { key: k(9), amount: 800_000 }, { key: k(10), amount: 400_000 },
    ])
  })
  it("tháng đã trả một phần chỉ nhận phần còn thiếu", () => {
    expect(allocatePayment([L(9, 800_000, 500_000), L(10, 300_000)], 300_000)).toEqual([{ key: k(9), amount: 300_000 }])
  })
  it("tháng đã miễn (fullPaid) bị bỏ qua", () => {
    expect(allocatePayment([L(8, 200_000, 0, true), L(9, 600_000)], 600_000)).toEqual([{ key: k(9), amount: 600_000 }])
  })
  it("trả trước (credit) tháng trước trừ vào tháng sau", () => {
    // T9 trả dư 100k → T10 chỉ còn 200k thiếu.
    expect(allocatePayment([L(9, 800_000, 900_000), L(10, 300_000)], 200_000)).toEqual([{ key: k(10), amount: 200_000 }])
  })
  it("không có nợ → toàn bộ vào tháng cuối", () => {
    expect(allocatePayment([L(9, 0), L(10, 0)], 100_000)).toEqual([{ key: k(10), amount: 100_000 }])
  })
  it("số tiền ≤ 0 hoặc danh sách rỗng → ném lỗi", () => {
    expect(() => allocatePayment([L(9, 100)], 0)).toThrow()
    expect(() => allocatePayment([], 100)).toThrow()
  })
  it("keyToYearMonth đảo monthKey", () => {
    expect(keyToYearMonth(monthKey(2026, 1))).toEqual({ year: 2026, month: 1 })
    expect(keyToYearMonth(monthKey(2025, 12))).toEqual({ year: 2025, month: 12 })
  })
})
```
Run `pnpm test tests/unit/lib/payment-allocation.test.ts` → FAIL (không có module).

- [ ] **Step 3: Cài đặt** — `src/lib/payment-allocation.ts`:
```ts
// Một tháng trong chuỗi dư nợ của 1 HS: tiền học tháng đó, đã thu ghi vào tháng đó, đã miễn chưa.
export type MonthLedger = { key: number; fee: number; paid: number; fullPaid: boolean }

// Chia khoản thu vào các tháng còn nợ từ cũ tới mới, cùng công thức dư cuối với computeClosingBalances
// (tháng miễn xoá nợ dương, trả dư chuyển sang). Dư sau tháng cuối → tháng cuối (tháng đang xem).
export function allocatePayment(months: MonthLedger[], amount: number): { key: number; amount: number }[] {
  if (amount <= 0) throw new Error("amount phải > 0")
  if (months.length === 0) throw new Error("months rỗng")
  const sorted = [...months].sort((a, b) => a.key - b.key)
  const out = new Map<number, number>()
  let balance = 0
  let left = amount
  for (const m of sorted) {
    let residual = balance + m.fee - m.paid
    if (m.fullPaid) residual = Math.min(0, residual)
    if (left > 0 && residual > 0) {
      const a = Math.min(left, residual)
      out.set(m.key, a)
      left -= a
      residual -= a
    }
    balance = residual
  }
  if (left > 0) {
    const last = sorted[sorted.length - 1].key
    out.set(last, (out.get(last) ?? 0) + left)
  }
  return [...out].map(([key, a]) => ({ key, amount: a }))
}

export function keyToYearMonth(key: number): { year: number; month: number } {
  return { year: Math.floor(key / 12), month: (key % 12) + 1 }
}
```
- [ ] **Step 4:** chạy lại → PASS. `tsc` + `lint`.
- [ ] **Step 5: Commit** `git add prisma/schema.prisma prisma/migrations src/lib/payment-allocation.ts tests/unit/lib/payment-allocation.test.ts` → `feat(y): cột batch_id cho khoản thu, hàm chia tiền trả tháng cũ trước`.

---

### Task 2: Server — ghi / sửa / xoá / liệt kê khoản thu theo đợt

**Files:**
- Modify: `src/server/services/tuition.service.ts` (thêm `loadMonthLedgers`), `src/server/services/payment.service.ts`, `src/lib/schemas/payment.ts`, `src/server/trpc/routers/payment.ts`, `src/server/trpc/routers/tuition.ts`, `src/lib/types/models.ts`
- Test: `tests/integration/payment-batch.test.ts` (mới)

**Interfaces:**
- Consumes: `allocatePayment`, `keyToYearMonth`, `MonthLedger` (Task 1).
- Produces:
  - `loadMonthLedgers(db: PrismaClient | Prisma.TransactionClient, userId: number, studentId: number, year: number, month: number): Promise<MonthLedger[]>` (mọi tháng có dữ liệu tới **và gồm** tháng `year/month`, tăng dần; luôn có tháng đích, fee 0 nếu trống).
  - `type PaymentBatchDTO = { batchId: string; amount: number; paidAt: string; note: string | null; allocations: { year: number; month: number; amount: number }[]; legacy: boolean }` (trong `models.ts`).
  - tRPC: `payment.record({ studentId, year, month, amount, paidAt?, note? })` → `{ batchId: string; allocations: {year,month,amount}[] }`; `payment.listBatches({ studentId, year, month })` → `PaymentBatchDTO[]`; `payment.deleteBatch({ batchId })` → `{ batchId }`; `payment.updateBatch({ batchId, amount, paidAt, note })` → `{ batchId }`; `tuition.ledgers({ studentId, year, month })` → `MonthLedger[]` (cho client xem trước).
  - Khoản thu cũ: `batchId` trả về dạng `"legacy-<id>"`, `legacy: true`.

- [ ] **Step 1: Test đỏ** — `tests/integration/payment-batch.test.ts`. Dùng mẫu dựng dữ liệu của `tests/integration/tuition-notice-sent.test.ts` (clean, `getAuthedCaller`, `subject.list`, `student.create` có `consent: CONSENT_ACCEPTED`, `session.create`, điểm danh bằng `db.sessionStudent.updateMany({ attendance: "present" })`). Dựng HS theo buổi 100k: T8 có 2 buổi có mặt (200k), T9 có 6 buổi có mặt (600k), dùng tháng thật = 2 tháng trước và tháng trước so với `vnDateParts()` (đặt `M1` = tháng trước nữa, `M2` = tháng trước, `M3` = tháng hiện tại). Các ca:
  1. **FIFO ghi ở tháng hiện tại**: `record({ year/month = M3, amount: 500_000 })` → `allocations` = `[{M1, 200_000}, {M2, 300_000}]`; `getMonthlyStatus(M2)` của HS: `paidAmount` 300_000; `listBatches(M2)` có 1 đợt amount 500_000, 2 allocations.
  2. **Đóng dư**: nợ 800k, `record(M2, 1_000_000)` → `[{M1,200k},{M2,600k}]` + dư 200k vào `M2` (tháng đang xem) → allocation M2 = 800_000; `getMonthlyStatus(M3).previousBalance` = −200_000.
  3. **2 lần record song song** (`Promise.all` 2 lần 800_000 ở M2): tổng paid M1 = 200_000 (không 400k), tổng `paidAmount` M1+M2 = 1_600_000, không lỗi.
  4. **Tháng miễn bỏ qua**: `tuition.updateSettlement({ M1, isFullPaid: true })` rồi `record(M2, 600_000)` → allocations chỉ `[{M2, 600_000}]`.
  5. **deleteBatch**: xoá đợt ca 1 → paid M1, M2 về 0; `listBatches` rỗng.
  6. **updateBatch**: đợt 500k sửa thành 250k + ngày mới → allocations mới `[{M1,200k},{M2,50k}]`, cùng `batchId`, ngày mới.
  7. **Legacy**: tạo bằng `payment.create({ M2, amount: 100_000, paidAt, method: "cash" })` → `listBatches(M2)` có `batchId: "legacy-<id>"`, `legacy: true`; `updateBatch` legacy amount 150_000 → paid M2 = 150_000 (không chia lại); `deleteBatch` legacy → 0.
  8. **Quyền**: `teacher2` gọi `deleteBatch` / `updateBatch` đợt của `teacher` → `NOT_FOUND`; `record` cho HS của teacher → `NOT_FOUND`. HS đã xoá mềm → `NOT_FOUND`.
  9. **Báo cáo**: sau ca 1, `report` tháng M1 "đã thu" tăng 200_000, tháng M2 tăng 300_000 (dùng procedure báo cáo tháng sẵn có; xem `tests/integration/report.test.ts` để gọi đúng).
  10. **`method` optional**: `payment.create` không truyền `method` → lưu `"cash"`.
  11. `tuition.ledgers(M3)` trả M1, M2, M3 tăng dần với fee đúng.
  Run → FAIL.

- [ ] **Step 2: `loadMonthLedgers`** trong `tuition.service.ts` (gần `computeClosingBalances`):
```ts
// Sổ từng tháng của 1 HS tới hết tháng đích (gồm cả tháng đích) cho chia tiền FIFO; cùng nguồn với computeClosingBalances.
export async function loadMonthLedgers(
  db: PrismaClient | Prisma.TransactionClient,
  userId: number,
  studentId: number,
  year: number,
  month: number
): Promise<MonthLedger[]> {
  const endDate = new Date(Date.UTC(year, month, 1))
  const [billingMap, snaps, links] = await Promise.all([
    loadBillingChanges(db, [studentId]),
    db.monthlyTuition.findMany({
      where: { studentId, OR: [{ year: { lt: year } }, { year, month: { lte: month } }] },
      select: { year: true, month: true, paidAmount: true, isFullPaid: true },
    }),
    db.sessionStudent.findMany({
      where: { studentId, session: { sessionDate: { lt: endDate }, userId, status: { not: "cancelled" }, isDeleted: false } },
      select: { fee: true, attendance: true, session: { select: { sessionDate: true } } },
    }),
  ])
  const changes = billingMap.get(studentId) ?? []
  const byKey = new Map<number, { links: { attendance: string; fee: number }[]; paid: number; fullPaid: boolean }>()
  const slot = (key: number) => {
    let d = byKey.get(key)
    if (!d) byKey.set(key, (d = { links: [], paid: 0, fullPaid: false }))
    return d
  }
  for (const s of snaps) {
    const d = slot(monthKey(s.year, s.month))
    d.paid = s.paidAmount
    d.fullPaid = s.isFullPaid
  }
  for (const l of links) {
    const date = l.session.sessionDate
    slot(date.getUTCFullYear() * 12 + date.getUTCMonth()).links.push({ attendance: l.attendance, fee: l.fee })
  }
  slot(monthKey(year, month))
  return [...byKey]
    .sort(([a], [b]) => a - b)
    .map(([key, d]) => ({ key, fee: monthFee(resolveBilling(changes, key), d.links), paid: d.paid, fullPaid: d.fullPaid }))
}
```
(import `type MonthLedger` từ `@/lib/payment-allocation`.)

- [ ] **Step 3: Schema** — `src/lib/schemas/payment.ts`:
  - `paymentCreateSchema.method` → `z.enum(PAYMENT_METHODS).default("cash")`; `paymentUpdateSchema.data.method` giữ optional.
  - Thêm:
```ts
export const paymentRecordSchema = z.object({ ...monthKey, amount: amountSchema, paidAt: paidAtSchema.optional(), note: noteSchema })
const batchIdSchema = z.string().min(1).max(60)
export const paymentBatchSchema = z.object({ batchId: batchIdSchema })
export const paymentUpdateBatchSchema = z.object({ batchId: batchIdSchema, amount: amountSchema, paidAt: paidAtSchema, note: noteSchema })
export type PaymentRecordInput = z.infer<typeof paymentRecordSchema>
export type PaymentUpdateBatchInput = z.infer<typeof paymentUpdateBatchSchema>
```

- [ ] **Step 4: Service** — thêm vào `payment.service.ts`:
```ts
import { randomUUID } from "node:crypto"
import { allocatePayment, keyToYearMonth } from "@/lib/payment-allocation"
import { loadMonthLedgers } from "./tuition.service"
import { vnTodayIso } from "@/lib/payment-summary"
import { monthKey } from "@/lib/billing"

const LEGACY = "legacy-"
// Khoá theo HS (khoá 2 số, không đụng khoá giới hạn gói 1 số theo userId): 2 lần ghi cùng HS phải chờ nhau.
const PAY_LOCK_NS = 7
async function lockStudentPayments(tx: Prisma.TransactionClient, studentId: number) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${PAY_LOCK_NS}::int, ${studentId}::int)`
}

async function writeAllocation(
  tx: Prisma.TransactionClient,
  userId: number,
  studentId: number,
  target: { year: number; month: number },
  amount: number,
  meta: { batchId: string; paidAt: string; note: string | null }
) {
  const ledgers = await loadMonthLedgers(tx, userId, studentId, target.year, target.month)
  const parts = allocatePayment(ledgers, amount)
  const allocations: { year: number; month: number; amount: number }[] = []
  for (const part of parts) {
    const ym = keyToYearMonth(part.key)
    // Dòng tháng đã được ensureMonthlyTuition tạo trước transaction; upsert để chắc khi request khác vừa thêm tháng.
    const mt = await tx.monthlyTuition.upsert({
      where: { studentId_year_month: { studentId, year: ym.year, month: ym.month } },
      update: {},
      create: { studentId, year: ym.year, month: ym.month },
    })
    await lockMonth(tx, mt.id)
    await tx.payment.create({
      data: { monthlyTuitionId: mt.id, amount: part.amount, paidAt: new Date(meta.paidAt), method: "cash", note: meta.note, batchId: meta.batchId },
    })
    await syncPaidAmount(tx, mt.id)
    allocations.push({ ...ym, amount: part.amount })
  }
  return allocations
}

// Tạo trước dòng tháng (kèm carry-over đúng) cho mọi tháng có thể nhận tiền, ngoài transaction như createPayment.
async function ensureLedgerMonths(db: PrismaClient, userId: number, studentId: number, year: number, month: number) {
  const ledgers = await loadMonthLedgers(db, userId, studentId, year, month)
  for (const l of ledgers) {
    const ym = keyToYearMonth(l.key)
    await ensureMonthlyTuition(db, userId, studentId, ym.year, ym.month)
  }
}

export async function recordPayment(db: PrismaClient, userId: number, input: PaymentRecordInput) {
  await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month) // kiểm quyền + HS còn sống
  await ensureLedgerMonths(db, userId, input.studentId, input.year, input.month)
  const batchId = randomUUID()
  const allocations = await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, input.studentId)
    return writeAllocation(tx, userId, input.studentId, input, input.amount, {
      batchId, paidAt: input.paidAt ?? vnTodayIso(), note: input.note ?? null,
    })
  }, TX_OPTIONS)
  return { batchId, allocations }
}
```
  `listBatches`, `deleteBatch`, `updateBatch`:
```ts
async function findBatchRows(db: PrismaClient | Prisma.TransactionClient, userId: number, batchId: string) {
  const where = batchId.startsWith(LEGACY)
    ? { id: Number(batchId.slice(LEGACY.length)) || -1 }
    : { batchId }
  const rows = await db.payment.findMany({
    where,
    include: { monthlyTuition: { select: { year: true, month: true, studentId: true, student: { select: { userId: true, isDeleted: true } } } } },
  })
  if (rows.length === 0 || rows.some((r) => r.monthlyTuition.student.userId !== userId || r.monthlyTuition.student.isDeleted)) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return rows
}

export async function listBatches(db: PrismaClient, userId: number, { studentId, year, month }: PaymentListInput): Promise<PaymentBatchDTO[]> {
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)
  const own = await db.payment.findMany({ where: { monthlyTuition: { studentId, year, month } } })
  const batchIds = [...new Set(own.map((p) => p.batchId).filter((b): b is string => b !== null))]
  const batched = batchIds.length
    ? await db.payment.findMany({ where: { batchId: { in: batchIds } }, include: { monthlyTuition: { select: { year: true, month: true } } } })
    : []
  const groups = new Map<string, PaymentBatchDTO>()
  for (const p of batched) {
    const g = groups.get(p.batchId!) ?? { batchId: p.batchId!, amount: 0, paidAt: p.paidAt.toISOString().slice(0, 10), note: p.note, allocations: [], legacy: false }
    g.amount += p.amount
    g.allocations.push({ year: p.monthlyTuition.year, month: p.monthlyTuition.month, amount: p.amount })
    groups.set(p.batchId!, g)
  }
  for (const p of own.filter((x) => x.batchId === null)) {
    groups.set(`${LEGACY}${p.id}`, {
      batchId: `${LEGACY}${p.id}`, amount: p.amount, paidAt: p.paidAt.toISOString().slice(0, 10), note: p.note,
      allocations: [{ year, month, amount: p.amount }], legacy: true,
    })
  }
  for (const g of groups.values()) g.allocations.sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month))
  return [...groups.values()].sort((a, b) => (a.paidAt < b.paidAt ? 1 : a.paidAt > b.paidAt ? -1 : 0))
}

export async function deleteBatch(db: PrismaClient, userId: number, batchId: string) {
  const rows = await findBatchRows(db, userId, batchId)
  await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, rows[0].monthlyTuition.studentId)
    for (const r of rows) {
      await lockMonth(tx, r.monthlyTuitionId)
      await tx.payment.update({ where: { id: r.id }, data: softDeleteData() })
      await syncPaidAmount(tx, r.monthlyTuitionId)
    }
  }, TX_OPTIONS).catch(rethrowNotFound)
  return { batchId }
}

// Đợt mới: xoá các dòng cũ rồi chia lại như chưa từng có, giữ batchId; tiền dư về tháng muộn nhất của đợt cũ.
// Khoản thu trước Y (legacy) sửa tại chỗ như updatePayment, không chia lại (spec Y §3.3).
export async function updateBatch(db: PrismaClient, userId: number, input: PaymentUpdateBatchInput) {
  const rows = await findBatchRows(db, userId, input.batchId)
  if (input.batchId.startsWith(LEGACY)) {
    await updatePayment(db, userId, rows[0].id, { amount: input.amount, paidAt: input.paidAt, note: input.note })
    return { batchId: input.batchId }
  }
  const studentId = rows[0].monthlyTuition.studentId
  const target = rows
    .map((r) => r.monthlyTuition)
    .reduce((a, b) => (monthKey(b.year, b.month) > monthKey(a.year, a.month) ? b : a))
  await ensureLedgerMonths(db, userId, studentId, target.year, target.month)
  await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, studentId)
    for (const r of rows) {
      await lockMonth(tx, r.monthlyTuitionId)
      await tx.payment.update({ where: { id: r.id }, data: softDeleteData() })
      await syncPaidAmount(tx, r.monthlyTuitionId)
    }
    await writeAllocation(tx, userId, studentId, target, input.amount, {
      batchId: input.batchId, paidAt: input.paidAt, note: input.note ?? null,
    })
  }, TX_OPTIONS).catch(rethrowNotFound)
  return { batchId: input.batchId }
}
```
  Import thêm: `PaymentRecordInput`, `PaymentUpdateBatchInput` (schemas), `PaymentBatchDTO` (models), `PaymentListInput` đã có.
  Lưu ý: `findBatchRows` dùng `findMany` → extension xoá mềm tự lọc `isDeleted:false` cho `Payment`. Dòng đã xoá mềm nằm lại với `batchId` cũ, không ảnh hưởng (lọc).
  `PaymentBatchDTO` thêm vào `src/lib/types/models.ts` theo Interfaces.

- [ ] **Step 5: Router** — `payment.ts` thêm (đều `planProcedure("payments")`): `record` (input `paymentRecordSchema`), `listBatches` (`paymentListSchema`), `deleteBatch` (`paymentBatchSchema`), `updateBatch` (`paymentUpdateBatchSchema`). `tuition.ts` thêm `ledgers: planProcedure("payments").input(paymentListSchema).query(...)` gọi `ensureMonthlyTuition` để kiểm quyền rồi trả `loadMonthLedgers(ctx.db, ctx.userId, input.studentId, input.year, input.month)`.

- [ ] **Step 6:** chạy test Task 2 + `tests/integration/payment.test.ts tests/integration/tuition*.test.ts tests/integration/report*.test.ts` → PASS. `tsc` + `lint`.
- [ ] **Step 7: Commit** `feat(y): ghi khoản thu theo đợt, tự trả tháng cũ trước; sửa/xoá/liệt kê theo đợt`.

---

### Task 3: Số hiển thị theo tháng + tháng đang học + nhãn phiếu

**Files:**
- Create: `src/lib/tuition-display.ts`
- Modify: `src/lib/tuition-status.ts` (thêm trạng thái `in_progress`), `src/server/services/tuition.service.ts` (DTO + lọc + `noticeStatus` + `setNoticeSent`), `src/server/services/tuition-notice.service.ts` (số QR), `src/server/services/report.service.ts` (nhãn phiếu ở cảnh báo nợ), `src/lib/types/models.ts`, `src/components/tuition/TuitionStatusBadge.tsx`, `src/components/tuition/TuitionNoticeBadge.tsx`, i18n
- Test: `tests/unit/lib/tuition-display.test.ts` (mới), `tests/unit/components/TuitionNoticeBadge.test.tsx`, `tests/unit/components/TuitionStatusBadge.test.tsx` (sửa), `tests/integration/tuition-in-progress.test.ts` (mới)

**Interfaces:**
- Produces (`src/lib/tuition-display.ts`):
```ts
export type DisplayRow = {
  previousBalance: number; totalExpected: number; totalAmountDue: number; paidAmount: number
  isFullPaid: boolean; billingMode: BillingMode; inProgress: boolean
}
export function isInProgressMonth(year: number, month: number, now?: Date): boolean
export function isProvisional(row: Pick<DisplayRow, "inProgress" | "billingMode">): boolean
export function dueNow(row: DisplayRow): number
export function rowStatusInput(row: DisplayRow): TuitionStatusInput
export function getRowStatus(row: DisplayRow): TuitionBadgeStatus
export function noticeAgeDays(sentAt: Date | string, now?: Date): number
export const NOTICE_OVERDUE_DAYS = 7
```
- `TuitionStatusDTO` thêm `inProgress: boolean`, `debtMonths: number` (số tháng liền trước còn nợ dương, 0 nếu `previousBalance ≤ 0`).
- `DashboardAlerts.debts[]` thêm `noticeSentAt: Date | string | null` (phiếu của **tháng trước**).
- `TuitionBadgeStatus` thêm `"in_progress"`.

- [ ] **Step 1: Test đỏ** — `tests/unit/lib/tuition-display.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { dueNow, getRowStatus, isInProgressMonth, isProvisional, noticeAgeDays, type DisplayRow } from "@/lib/tuition-display"

const base: DisplayRow = { previousBalance: 0, totalExpected: 0, totalAmountDue: 0, paidAmount: 0, isFullPaid: false, billingMode: "per_session", inProgress: false }
const NOW = new Date("2026-10-13T05:00:00Z") // 13/10 giờ VN

describe("tuition-display (spec Y §3.4, §3.5)", () => {
  it("isInProgressMonth: tháng hiện tại và tương lai = đang học", () => {
    expect(isInProgressMonth(2026, 10, NOW)).toBe(true)
    expect(isInProgressMonth(2026, 11, NOW)).toBe(true)
    expect(isInProgressMonth(2026, 9, NOW)).toBe(false)
  })
  it("tháng đã kết thúc: cần đóng = tổng − đã đóng", () => {
    expect(dueNow({ ...base, previousBalance: 200_000, totalExpected: 600_000, totalAmountDue: 800_000, paidAmount: 300_000 })).toBe(500_000)
  })
  it("tháng đang học, theo buổi: không cộng tiền tạm tính", () => {
    const r = { ...base, inProgress: true, previousBalance: 800_000, totalExpected: 300_000, totalAmountDue: 1_100_000 }
    expect(isProvisional(r)).toBe(true)
    expect(dueNow(r)).toBe(800_000)
    expect(dueNow({ ...r, paidAmount: 800_000 })).toBe(0)
  })
  it("tháng đang học, trọn tháng: cộng cả tháng", () => {
    const r = { ...base, inProgress: true, billingMode: "monthly" as const, previousBalance: 0, totalExpected: 400_000, totalAmountDue: 400_000 }
    expect(isProvisional(r)).toBe(false)
    expect(dueNow(r)).toBe(400_000)
  })
  it("đã miễn → 0; trả trước (âm) → 0", () => {
    expect(dueNow({ ...base, totalAmountDue: 500_000, isFullPaid: true })).toBe(0)
    expect(dueNow({ ...base, totalAmountDue: -100_000 })).toBe(0)
  })
  it("trạng thái tháng đang học: hết nợ cũ → Đã đóng đủ; chưa có gì phải đóng → in_progress", () => {
    const r = { ...base, inProgress: true, previousBalance: 800_000, totalExpected: 300_000, totalAmountDue: 1_100_000 }
    expect(getRowStatus(r)).toBe("unpaid")
    expect(getRowStatus({ ...r, paidAmount: 800_000 })).toBe("fully_paid")
    expect(getRowStatus({ ...r, previousBalance: 0, totalAmountDue: 300_000 })).toBe("in_progress")
  })
  it("noticeAgeDays theo ngày VN", () => {
    expect(noticeAgeDays(new Date("2026-10-05T03:00:00Z"), NOW)).toBe(8)
    expect(noticeAgeDays(new Date("2026-10-12T18:00:00Z"), NOW)).toBe(0) // 13/10 01:00 giờ VN
  })
})
```
`tests/integration/tuition-in-progress.test.ts`: HS theo buổi, nợ tháng trước 800k + tháng hiện tại 3 buổi có mặt → `getMonthlyStatus(tháng hiện tại)` item `inProgress: true`, `debtMonths: 1`, lọc `status: "unpaid"` có HS; sau `record` 800k → lọc `"fully_paid"` có HS. HS trọn tháng 400k không nợ → tháng hiện tại `unpaid`. `tuition.getNotice(tháng hiện tại)` của HS theo buổi → `qr.amount` = 800_000 (không 1.100.000). `report.alerts` (cảnh báo nợ) có `noticeSentAt` = ngày đã `setNoticeSent` cho tháng trước.
`TuitionNoticeBadge.test.tsx` thêm: `noticeStatus "sent"`, `noticeSentAt` 8 ngày trước, `due > 0` → chữ "Đã gửi 5/10 · 8 ngày" và class amber; 3 ngày → không amber; `due 0` → "Đã gửi 5/10" xanh như cũ.
Run → FAIL.

- [ ] **Step 2: Cài đặt `src/lib/tuition-display.ts`**:
```ts
import { monthKey, type BillingMode } from "@/lib/billing"
import { vnDateParts } from "@/lib/utils"
import { getTuitionBadgeStatus, type TuitionBadgeStatus, type TuitionStatusInput } from "@/lib/tuition-status"

export type DisplayRow = {
  previousBalance: number; totalExpected: number; totalAmountDue: number; paidAmount: number
  isFullPaid: boolean; billingMode: BillingMode; inProgress: boolean
}

export const NOTICE_OVERDUE_DAYS = 7

export function isInProgressMonth(year: number, month: number, now: Date = new Date()): boolean {
  const t = vnDateParts(now)
  return monthKey(year, month) >= monthKey(t.year, t.month)
}

// Tháng đang học của HS theo buổi chỉ là tạm tính: chưa cộng vào số phải đóng (spec Y D9).
export function isProvisional(row: Pick<DisplayRow, "inProgress" | "billingMode">): boolean {
  return row.inProgress && row.billingMode === "per_session"
}

export function rowStatusInput(row: DisplayRow): TuitionStatusInput {
  return isProvisional(row) ? { ...row, totalAmountDue: row.previousBalance, totalExpected: 0 } : row
}

export function dueNow(row: DisplayRow): number {
  if (row.isFullPaid) return 0
  const s = rowStatusInput(row)
  return Math.max(0, s.totalAmountDue - row.paidAmount)
}

export function getRowStatus(row: DisplayRow): TuitionBadgeStatus {
  const status = getTuitionBadgeStatus(rowStatusInput(row))
  return status === "no_sessions" && isProvisional(row) ? "in_progress" : status
}

export function noticeAgeDays(sentAt: Date | string, now: Date = new Date()): number {
  const a = vnDateParts(new Date(sentAt))
  const b = vnDateParts(now)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}
```
`src/lib/tuition-status.ts`: thêm `| "in_progress"` vào `TuitionBadgeStatus` (không đổi `getTuitionBadgeStatus`). `matchesTuitionStatusFilter` giữ; server truyền `rowStatusInput(item)`.

- [ ] **Step 3: Server**
  - `getMonthlyTuitionStatus`: `const inProgress = isInProgressMonth(year, month)` một lần; mỗi item thêm `inProgress`, `debtMonths` (đếm lùi từ khoá `year*12+month-2` trong `closingBalances.get(student.id)` khi giá trị > 0, tối đa 12; 0 nếu `previousBalance ≤ 0`). `remaining` dùng cho `noticeStatus` đổi thành `dueNow({...item, inProgress})`. Lọc trạng thái: `matchesTuitionStatusFilter(rowStatusInput(item), status)`. Lọc `noticeFilter "unsent"`: `remaining` cũng dùng `dueNow`. Map đầu ra thêm `inProgress`, `debtMonths`.
  - `setNoticeSent`: `remaining` = `dueNow({ ...item, inProgress: isInProgressMonth(input.year, input.month) })`.
  - `tuition-notice.service.ts`: `remaining` = `dueNow(...)` (QR + "còn lại" của phiếu); thêm `inProgress` vào DTO phiếu (`TuitionNoticeDTO.inProgress: boolean`).
  - `report.service.ts` `getDashboardAlerts`: sau khi có `debts`, đọc `db.monthlyTuition.findMany({ where: { studentId: { in: ids }, year: prevYear, month: prevMonth }, select: { studentId: true, noticeSentAt: true } })` (tháng trước của `year/month` hiện tại) → gắn `noticeSentAt` (null nếu không có). Cập nhật kiểu `DashboardAlerts`.
- [ ] **Step 4: Badge**
  - `TuitionStatusBadge`: nhận thêm `inProgress`, `billingMode` qua `item`, dùng `getRowStatus`; case `"in_progress"` → nhãn `t("tuition_in_progress")` màu `IN_PROGRESS`.
  - `TuitionNoticeBadge`: prop `item` thêm `due?: number`. Khi `"sent"` và `due > 0`: nhãn `t("notice_sent_age").replace("{d}", d).replace("{n}", String(age))`, class amber nếu `age >= NOTICE_OVERDUE_DAYS`, ngược lại slate. `due` 0/undefined → như cũ (xanh "Đã gửi d").
  - i18n: `tuition_in_progress` "Đang học" / "In progress"; `notice_sent_age` "Đã gửi {d} · {n} ngày" / "Sent {d} · {n} days".
- [ ] **Step 5:** chạy test Task 3 + `tests/unit/components/TuitionStatusBadge.test.tsx tests/integration/tuition*.test.ts tests/integration/dashboard-alerts.test.ts tests/integration/report*.test.ts` → PASS (sửa test cũ chỉ khi đổi kỳ vọng do D9 và ghi Ruling). `tsc` + `lint`.
- [ ] **Step 6: Commit** `feat(y): tháng đang học chỉ tạm tính, số cần đóng ngay, nhãn phiếu báo đếm ngày`.

---

### Task 4: Danh sách Học phí — mặc định tháng trước + nút "Đã đóng đủ" 1 chạm

**Files:**
- Modify: `src/hooks/useCalendar.ts`, `src/app/(app)/tuition/page.tsx`, i18n
- Create: `src/components/tuition/TuitionAmountCell.tsx`, `src/hooks/useRecordPayment.ts`
- Test: `tests/unit/hooks/useCalendar.test.ts` (mới hoặc bổ sung), `tests/unit/components/TuitionAmountCell.test.tsx` (mới), `tests/unit/hooks/useRecordPayment.test.tsx` (mới), `tests/unit/components/TuitionPageMobileCard.test.tsx` (sửa)

**Interfaces:**
- Consumes: `payment.record`, `payment.deleteBatch` (Task 2); `dueNow`, `isProvisional`, `getRowStatus`, `inProgress`, `debtMonths` (Task 3).
- Produces: `useCalendar(options?: { defaultOffset?: number })`; `useRecordPayment(): { pay: (row: { studentId: number; year: number; month: number }, amount: number, paidAt?: string) => void; payFull: (row: { studentId: number; year: number; month: number }, amount: number) => void; isPending: boolean }` (Task 5 dùng `pay`); `TuitionAmountCell({ item, month, className? })`.

- [ ] **Step 1: Test đỏ**
  - `useCalendar`: không có `year/month` trên URL + `defaultOffset: -1`, hôm nay 13/10/2026 → `{ year: 2026, month: 9 }`; 15/01/2026 → `{ 2025, 12 }`; có URL thì theo URL. (Mock `next/navigation` như các test hook sẵn có; dùng `vi.setSystemTime`.)
  - `TuitionAmountCell`: tháng đã kết thúc, `previousBalance 200k`, `totalExpected 600k`, `debtMonths 1`, tháng 9 → số to "800.000 đ", dòng nhỏ "T8 còn 200.000 · T9 600.000"; `debtMonths 3` → "Nợ 3 tháng trước 200.000 · T9 600.000"; tháng đang học theo buổi → số to = nợ cũ, dòng nhỏ "T10 tạm tính 300.000"; không nợ cũ, tháng kết thúc → chỉ số to, không dòng nhỏ.
  - `useRecordPayment`: `payFull` gọi `payment.record.mutate({ studentId, year, month, amount })` 1 lần; `onSuccess` gọi `toast(…, { action: { label: "Hoàn tác" } })`; bấm action → `utils.client.payment.deleteBatch.mutate({ batchId })`; callback nằm ở cấp `useMutation` (unmount trước khi resolve vẫn toast — mẫu test U3 trong `TuitionNoticeDialog.test.tsx`).
  - Mobile card: nút "Đã đóng đủ 800.000 đ" khi `dueNow > 0`, không có nút khi 0; không còn nút "Ghi nhận".
  Run → FAIL.
- [ ] **Step 2: `useCalendar`** — chữ ký `useCalendar(options: { defaultOffset?: number } = {})`; khi URL không có `year`/`month`: lấy `now` cộng `defaultOffset` tháng (`new Date(now.getFullYear(), now.getMonth() + offset, 1)`). Các nơi khác gọi `useCalendar()` giữ nguyên.
- [ ] **Step 3: `useRecordPayment`**:
```ts
"use client"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Toast + Hoàn tác đặt ở callback cấp useMutation: vẫn chạy khi sheet/dòng đã đóng (bài học U3).
export function useRecordPayment() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const mut = trpc.payment.record.useMutation({
    onSuccess: (res, vars) => {
      void utils.tuition.invalidate()
      void utils.payment.invalidate()
      const months = res.allocations.map((a) => `T${a.month}`).join(", ")
      toast(t("payment_recorded").replace("{amount}", formatCurrency(vars.amount)).replace("{months}", months), {
        action: {
          label: t("undo"),
          onClick: () => {
            void utils.client.payment.deleteBatch
              .mutate({ batchId: res.batchId })
              .then(() => Promise.all([utils.tuition.invalidate(), utils.payment.invalidate()]))
              .catch((e: Error) => toast.error(e.message))
          },
        },
      })
    },
    onError: (e) => toast.error(e.message),
  })
  type Row = { studentId: number; year: number; month: number }
  const pay = (row: Row, amount: number, paidAt?: string) =>
    mut.mutate({ studentId: row.studentId, year: row.year, month: row.month, amount, ...(paidAt && { paidAt }) })
  return { pay, payFull: (row: Row, amount: number) => pay(row, amount), isPending: mut.isPending }
}
```
  i18n: `payment_recorded` "Đã ghi {amount} cho {months}" / "Recorded {amount} for {months}"; `pay_full` "Đã đóng đủ {amount}" / "Paid in full {amount}"; `tuition_viewing_prev` "Đang xem tháng trước để chốt học phí." / "Viewing last month to close tuition."; `tuition_view_month` "Xem tháng {m}" / "View month {m}"; `tuition_viewing_current` "Tháng đang học: tiền buổi chỉ tạm tính." / "Current month: session fees are provisional."; `debt_prev_month` "T{m} còn {amount}" / "M{m} owes {amount}"; `debt_n_months` "Nợ {n} tháng trước {amount}" / "{n} months owed {amount}"; `month_fee_short` "T{m} {amount}" / "M{m} {amount}"; `month_provisional` "T{m} tạm tính {amount}" / "M{m} provisional {amount}".
- [ ] **Step 4: `TuitionAmountCell`** (dùng cho cột "Số tiền cần đóng" và thẻ mobile):
```tsx
"use client"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { dueNow, getRowStatus, isProvisional, type DisplayRow } from "@/lib/tuition-display"

type Item = DisplayRow & { debtMonths: number }

export function TuitionAmountCell({ item, month, className }: { item: Item; month: number; className?: string }) {
  const { t } = useTranslation()
  const due = dueNow(item)
  const prevM = month === 1 ? 12 : month - 1
  const parts: string[] = []
  if (item.previousBalance > 0 && item.totalExpected > 0) {
    parts.push(
      item.debtMonths > 1
        ? t("debt_n_months").replace("{n}", String(item.debtMonths)).replace("{amount}", formatCurrency(item.previousBalance))
        : t("debt_prev_month").replace("{m}", String(prevM)).replace("{amount}", formatCurrency(item.previousBalance))
    )
  }
  if (isProvisional(item) && item.totalExpected > 0) {
    parts.push(t("month_provisional").replace("{m}", String(month)).replace("{amount}", formatCurrency(item.totalExpected)))
  } else if (parts.length > 0) {
    parts.push(t("month_fee_short").replace("{m}", String(month)).replace("{amount}", formatCurrency(item.totalExpected)))
  }
  const status = getRowStatus(item)
  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <span className={cn("whitespace-nowrap font-semibold tabular-nums", status === "unpaid" ? "text-debt" : due === 0 ? "text-muted-foreground" : "text-foreground")}>
        {formatCurrency(due)}
      </span>
      {parts.length > 0 && <span className="text-xs text-slate-500 tabular-nums">{parts.join(" · ")}</span>}
    </div>
  )
}
```
- [ ] **Step 5: `page.tsx`**
  - `useCalendar({ defaultOffset: -1 })`; lấy thêm `goToMonth`.
  - Dưới `<FilterBar …/>` thêm dòng nhắc: nếu `monthKey(year, month)` = tháng trước giờ VN → `t("tuition_viewing_prev")` + nút ghost `t("tuition_view_month").replace("{m}", <tháng hiện tại>)` gọi `goToMonth(<năm hiện tại>, <tháng hiện tại>)`; nếu `isInProgressMonth(year, month)` → `t("tuition_viewing_current")`. Khung `rounded-lg bg-primary/[0.06] px-3 py-2 text-sm text-primary`.
  - Thay `payButton` bằng:
```tsx
  const recordPayment = useRecordPayment()
  const payFullButton = (item: TuitionStatusItem, className?: string) => {
    const due = dueNow(item)
    if (due === 0) return null
    return (
      <Button
        size="sm"
        className={className}
        disabled={recordPayment.isPending}
        onClick={(e) => {
          e.stopPropagation()
          if (paymentsGate.locked) paymentsGate.openUpgrade()
          else recordPayment.payFull({ studentId: item.studentId, year, month }, due)
        }}
      >
        {t("pay_full").replace("{amount}", formatCurrency(due))}
        {paymentsGate.locked && <LockBadge plan={paymentsGate.requiredPlan} className="ml-1.5" />}
      </Button>
    )
  }
```
  - Cột "Số tiền cần đóng" → `<TuitionAmountCell item={item} month={month} />` (đổi `className` cột thành `w-[200px] text-right`); thẻ mobile thay khối số tiền bằng `TuitionAmountCell` và `payButton(item, "h-11")` bằng `payFullButton(item, "h-11 flex-1")`.
  - `TuitionNoticeBadge item={{ ...item, due: dueNow(item) }}` ở cả bảng và thẻ.
  - `TuitionStatusBadge item={item}` (item đã có `inProgress`, `billingMode`).
  - Bấm dòng vẫn mở sheet (giữ `onRowClick`). Xoá import không còn dùng (`Wallet`, `amountClass`, `SETTLED` nếu không dùng nữa).
- [ ] **Step 6:** chạy test Task 4 + `tests/unit/components/Tuition*.test.tsx` → PASS (test cũ tìm nút "Ghi nhận" → sửa theo luồng mới, ghi Ruling). `tsc` + `lint`.
- [ ] **Step 7: Commit** `feat(y): màn Học phí mặc định tháng trước, tiền tách theo tháng, nút Đã đóng đủ 1 chạm có hoàn tác`.

---

### Task 5: Sheet chi tiết — thu tiền tại chỗ, lịch sử theo đợt, bỏ nút Lưu chung

**Files:**
- Modify: `src/components/tuition/TuitionDetailSheet.tsx` (viết lại `TuitionDetailBody`), `src/components/tuition/PaymentFormDialog.tsx` (thành hộp **sửa đợt**), `src/app/(app)/tuition/page.tsx` (bỏ prop `onSuccess` nếu thành thừa), i18n
- Create: `src/components/tuition/PayBlock.tsx`, `src/components/tuition/WaiveDialog.tsx`
- Test: `tests/unit/components/TuitionDetailSheetPay.test.tsx` (mới), sửa `TuitionDetailSheetNoticeButton.test.tsx`, `TuitionDetailSheetNoticeMark.test.tsx`

**Interfaces:**
- Consumes: `useRecordPayment` (Task 4), `payment.listBatches/updateBatch/deleteBatch`, `tuition.ledgers` (Task 2), `allocatePayment`, `keyToYearMonth` (Task 1), `dueNow`, `isProvisional`, `noticeAgeDays` (Task 3), `tuition.updateSettlement` (sẵn có).
- Produces: `PayBlock({ studentId, year, month, due })`, `WaiveDialog({ open, onOpenChange, amount, month, onConfirm })`.

- [ ] **Step 1: Test đỏ** — `TuitionDetailSheetPay.test.tsx` (mock `@/lib/trpc` theo mẫu `TuitionDetailSheetNoticeMark.test.tsx`, đủ `useUtils`, `tuition.getMonthlyStatus`, `tuition.ledgers`, `payment.listBatches`, `payment.record`, `payment.deleteBatch`, `tuition.updateSettlement`, `tuition.setNoticeSent`):
  1. Không còn checkbox "Đánh dấu đã đóng đủ", không còn nút "Lưu" ở chân, không còn dòng cảnh báo "Hệ thống tự động chốt dư nợ".
  2. Bảng tiền tháng 9 có dòng "Tháng 8 còn thiếu 200.000 đ" (`debtMonths 1`), "Học phí tháng 9" kèm buổi, "Đã đóng", "Còn thiếu 800.000 đ".
  3. Bấm "Đã đóng đủ 800.000 đ" → `payment.record.mutate` với `{ studentId, year: 2026, month: 9, amount: 800_000 }`.
  4. Bấm "Đóng một phần" → hiện ô số tiền; gõ 500000 → dòng xem trước "Trừ vào T8: 200.000, T9: 300.000" (từ `tuition.ledgers` mock); bấm "Ghi nhận" → `record.mutate` amount 500_000.
  5. Lịch sử: đợt `{ amount: 500_000, allocations: [T8 200k, T9 300k] }` hiện "500.000 đ" + "T8 200.000 · T9 300.000"; ⋮ → Xoá → xác nhận → `deleteBatch.mutate({ batchId })`.
  6. Ghi chú: gõ rồi blur → `updateSettlement.mutate({ studentId, year, month, isFullPaid: <giá trị hiện tại>, notes })` đúng 1 lần; không blur thì không gọi.
  7. Menu ⋮ đầu sheet → "Miễn phần còn thiếu" → hộp xác nhận "Miễn 800.000 đ tháng 9" → bấm "Miễn 800.000 đ" → `updateSettlement.mutate({ …, isFullPaid: true })`. Đã miễn → menu có "Bỏ miễn" → `isFullPaid: false`.
  8. Tháng đang học theo buổi: bảng có dòng "Tháng 10 tạm tính · đã học 3 buổi", nút "Đã đóng đủ" = số nợ cũ.
  Run → FAIL.

- [ ] **Step 2: `PayBlock.tsx`**
```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { allocatePayment, keyToYearMonth } from "@/lib/payment-allocation"
import { vnTodayIso } from "@/lib/payment-summary"
import { useRecordPayment } from "@/hooks/useRecordPayment"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function PayBlock({ studentId, year, month, due }: { studentId: number; year: number; month: number; due: number }) {
  const { t } = useTranslation()
  const { pay, payFull, isPending } = useRecordPayment()
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState(0)
  const [dateOpen, setDateOpen] = useState(false)
  const [paidAt, setPaidAt] = useState(vnTodayIso())
  const ledgers = trpc.tuition.ledgers.useQuery({ studentId, year, month }, { enabled: partial })
  const preview = partial && amount > 0 && ledgers.data ? allocatePayment(ledgers.data, amount) : []
  // ... render theo spec Y §4.2 mục 3
}
```
  Render:
  - Tiêu đề nhỏ `t("collect_payment")` ("Thu tiền").
  - Lưới 2 cột (1 cột ≤ 420px): nút primary `t("pay_full").replace("{amount}", formatCurrency(due))` (ẩn khi `due === 0`) → `payFull({ studentId, year, month }, due)`; nút outline `t("pay_partial")` ("Đóng một phần") bật/tắt khung.
  - Khung `partial`: `CurrencyInput` id `pay-amount` (label `t("pay_amount_label")` "Số tiền phụ huynh đưa"); dòng xem trước `t("pay_preview").replace("{parts}", preview.map(p => \`T${keyToYearMonth(p.key).month}: ${formatCurrency(p.amount)}\`).join(", "))` ("Trừ vào {parts}"); nút ghost `t("paid_at_today_change")` ("Ngày thu: {d} · Đổi") mở `Input type="date"` gán `paidAt`; nút primary `t("record_payment_submit")` ("Ghi nhận") disabled khi `amount <= 0 || isPending` → `pay({ studentId, year, month }, amount, paidAt)` (cùng toast/Hoàn tác của hook Task 4), rồi `setPartial(false); setAmount(0)`.
- [ ] **Step 3: `WaiveDialog.tsx`** — `AlertDialog`: tiêu đề `t("waive_title")` ("Miễn phần còn thiếu"), mô tả `t("waive_desc").replace("{amount}", …).replace("{m}", …)` ("Miễn {amount} tháng {m}. Phần này không chuyển sang tháng sau."), nút huỷ + nút đỏ nhạt `t("waive_confirm").replace("{amount}", …)` ("Miễn {amount}") → `onConfirm()`.
- [ ] **Step 4: Viết lại `TuitionDetailBody`** (giữ khung `TuitionDetailSheet` Dialog/Sheet, `TuitionNoticeDialog`, khoá Plus):
  - Bỏ: `edits`, `dirty`, `settlementBlock`, checkbox, `showWaivedWarning`, footer (`payment_tip_snapshot` + nút Phiếu báo + nút Lưu), `paymentsQuery` cũ, `form` state cho tạo mới, prop `onSaved`.
  - Thứ tự:
    1. Đầu: tên, `t("tuition_month_title")` ("Học phí tháng {m}/{y}"), `TuitionStatusBadge`, `DropdownMenu` ⋮: `isFullPaid` ? "Bỏ miễn" (`t("unwaive")`) : "Miễn phần còn thiếu" (`t("waive_title")`, ẩn khi `dueNow(row) === 0`).
    2. Bảng tiền: dòng nợ trước (khi `previousBalance !== 0`): nhãn `debtMonths > 1 ? t("debt_n_months_label").replace("{n}", …) ("Nợ {n} tháng trước") : t("debt_prev_month_label").replace("{m}", prevM) ("Tháng {m} còn thiếu")`, số âm → nhãn `t("prepaid_label")` ("Đã trả trước") màu xanh; dòng học phí tháng: nếu `isProvisional(row)` → `t("month_provisional_line").replace("{m}", month).replace("{p}", presentSessions)` ("Tháng {m} tạm tính · đã học {p} buổi") chữ xám, ngược lại nhãn cũ (`tuition_monthly_package_line` / `current_month_fee (p/n buổi)`); `t("paid_total")`; dòng tổng `isProvisional ? t("due_now") ("Cần đóng ngay") : t("remaining_due") ("Còn thiếu")` = `dueNow(row)` (đã miễn → `t("waived")` + số miễn).
    3. `<PayBlock studentId year month due={dueNow(row)} />` (khoá Plus → `LockedSection` như cũ).
    4. Phiếu báo: giữ khối hiện tại; thêm dòng tuổi phiếu (`noticeAgeDays`) amber khi ≥ 7 và `dueNow > 0`; thêm nút `t("tuition_notice")` mở `TuitionNoticeDialog` (trước nằm ở footer).
    5. Lịch sử thu: `trpc.payment.listBatches.useQuery({ studentId, year, month }, { enabled: !paymentsLocked })`; mỗi đợt: ngày, ghi chú, tổng tiền, dòng nhỏ chia tháng `T{m} {amount}` nối " · " (chỉ hiện khi > 1 phần hoặc phần đó khác tháng đang xem); ⋮: Sửa (mở `PaymentFormDialog` chế độ sửa đợt) / Xoá (`AlertDialog` → `payment.deleteBatch`).
    6. Ghi chú: `Textarea` state cục bộ khởi từ `row.notes`; `onBlur` nếu khác `row.notes ?? ""` → `updateSettlement.mutate({ studentId, year, month, isFullPaid: row.isFullPaid, notes })`, thành công hiện chữ nhỏ `t("notes_saved")` ("Đã lưu").
  - Miễn: `WaiveDialog` → `updateSettlement.mutate({ …, isFullPaid: true, notes: row.notes ?? undefined })`; Bỏ miễn → `isFullPaid: false`.
- [ ] **Step 5: `PaymentFormDialog` → sửa đợt**: props `{ studentId, year, month, batch: PaymentBatchDTO, onClose }`; bỏ chọn hình thức (`METHOD_LABEL`, `method` state), bỏ nút "Số còn lại"; giữ số tiền / ngày / ghi chú; Lưu → `payment.updateBatch.mutate({ batchId: batch.batchId, amount, paidAt, note })`. Tiêu đề `t("edit_payment")`.
- [ ] **Step 6: i18n** (vi / en): `collect_payment` Thu tiền / Collect payment; `pay_partial` Đóng một phần / Partial payment; `pay_amount_label` Số tiền phụ huynh đưa / Amount received; `pay_preview` Trừ vào {parts} / Applied to {parts}; `paid_at_today_change` Ngày thu: {d} · Đổi / Date: {d} · Change; `record_payment_submit` Ghi nhận / Record; `waive_title` Miễn phần còn thiếu / Waive the remainder; `waive_desc` Miễn {amount} tháng {m}. Phần này không chuyển sang tháng sau. / Waive {amount} for month {m}. It will not carry over.; `waive_confirm` Miễn {amount} / Waive {amount}; `unwaive` Bỏ miễn / Undo waiver; `tuition_month_title` Học phí tháng {m}/{y} / Tuition {m}/{y}; `debt_prev_month_label` Tháng {m} còn thiếu / Month {m} owed; `debt_n_months_label` Nợ {n} tháng trước / {n} months owed; `prepaid_label` Đã trả trước / Prepaid; `month_provisional_line` Tháng {m} tạm tính · đã học {p} buổi / Month {m} provisional · {p} sessions; `due_now` Cần đóng ngay / Due now; `remaining_due` Còn thiếu / Remaining; `notes_saved` Đã lưu / Saved; `edit_payment` Sửa lần thu / Edit payment. Xoá key không còn dùng: `payment_tip_snapshot`, `mark_fully_paid`, `settled_waived_warning`, `settled_waived_warning_suffix`, `settlement_saved` (grep trước khi xoá; còn nơi dùng thì giữ).
- [ ] **Step 7:** chạy test Task 5 + `tests/unit/components/Tuition*.test.tsx` → PASS. `tsc` + `lint`.
- [ ] **Step 8: Commit** `feat(y): chi tiết học phí thu tiền tại chỗ, lịch sử theo đợt, ghi chú tự lưu, miễn trong menu`.

---

### Task 6: Phiếu báo, cảnh báo Tổng quan, bỏ hình thức thanh toán

**Files:**
- Modify: `src/components/tuition/TuitionNoticeCard.tsx`, `src/components/dashboard/DashboardAlerts.tsx`, i18n
- Test: `tests/unit/components/TuitionNoticeCard.test.tsx` (sửa), `tests/unit/components/DashboardAlerts.test.tsx` (sửa hoặc tạo)

- [ ] **Step 1: Test đỏ**
  - Phiếu báo: dòng nợ trước nhãn "Tháng 8 còn thiếu" (`debtMonths` 1, cần thêm `debtMonths` vào `TuitionNoticeDTO` ở service) / "Nợ 3 tháng trước"; danh sách lần thu **không** có "Tiền mặt"/"Chuyển khoản"; tháng đang học theo buổi: dòng "Tháng 10 tạm tính" và "Còn lại" = nợ cũ.
  - Cảnh báo nợ: dòng có `noticeSentAt` 8 ngày trước → nhãn "Đã gửi phiếu 5/10 · 8 ngày" amber; `null` → "Chưa gửi phiếu".
  Run → FAIL.
- [ ] **Step 2: Cài đặt**
  - `tuition-notice.service.ts`: thêm `debtMonths` (dùng cùng cách đếm như Task 3, có thể lấy từ item `getMonthlyTuitionStatus`), `inProgress` đã thêm ở Task 3.
  - `TuitionNoticeCard`: nhãn nợ trước theo `debtMonths` (dùng key `debt_prev_month_label` / `debt_n_months_label` của Task 5); bỏ `t(p.method === …)` ở danh sách lần thu (giữ ngày · số tiền); khi `inProgress && billingMode === "per_session"`: dòng "tiền học tháng" đổi nhãn `month_provisional_line`, không cộng vào tổng hiển thị (dùng `remaining` của service).
  - `DashboardAlerts`: mỗi dòng nợ thêm badge: `noticeSentAt` → `t("notice_sent_age")` (amber khi ≥ 7 ngày) ; null → `t("notice_unsent_badge")` ("Chưa gửi phiếu" / "Notice not sent").
- [ ] **Step 3:** chạy test Task 6 + `tests/integration/tuition-notice*.test.ts tests/integration/parent-link.test.ts` → PASS. `tsc` + `lint`.
- [ ] **Step 4: Commit** `feat(y): phiếu báo và cảnh báo nợ tách theo tháng, nhãn ngày gửi phiếu, bỏ hình thức thanh toán`.

---

### Task 7: Trang phụ huynh 2 cột trên máy tính + modal link 4 nút 1 hàng

**Files:**
- Modify: `src/components/parent/ParentView.tsx`, `src/components/tuition/TuitionNoticeCard.tsx`, `src/components/students/ParentLinkDialog.tsx`, i18n
- Test: `tests/unit/components/ParentView.test.tsx`, `tests/unit/components/TuitionNoticeCard.test.tsx`, `tests/unit/components/ParentLinkDialog.test.tsx` (sửa/bổ sung), `tests/e2e/parent-link.spec.ts` (bổ sung)

**Interfaces:**
- Consumes: `TuitionNoticeCard` sau Task 6.
- Produces: `TuitionNoticeCard` thêm prop `variant?: "default" | "wide"` (mặc định `"default"` = y như hiện tại).

- [ ] **Step 1: Test đỏ**
  - `TuitionNoticeCard`: `variant="wide"` → không có chữ "Ngày học", phần tử `data-testid="notice-card"` không có `style.width` 360 (có class `w-full`), khối QR có `data-testid="notice-qr-side"` với class `grid`; mặc định → vẫn có "Ngày học" và width 360.
  - `ParentView` (chỉ render 1 phiếu, `variant` theo `useMediaQuery("(min-width: 1024px)")`): mock `matchMedia` true → phiếu bản wide, false → bản default. Kiểm thêm: khung ngoài có class `lg:max-w-6xl`; lưới có `lg:grid-cols-[minmax(0,1fr)_400px]`; cột phiếu có `lg:sticky` và `order-first lg:order-last`; 3 ô tóm tắt `data-testid="parent-stat"` với số Có mặt / Vắng (absent) / Tổng buổi đúng theo `view.attendance`.
  - `ParentLinkDialog`: `DialogContent` có class `sm:max-w-[640px]`; khung nút có `sm:flex-nowrap`.
  - e2e `parent-link.spec.ts`: viewport 1280×800, mở link → phần tử điểm danh (tiêu đề "Điểm danh tháng") và ảnh QR (`img[alt="VietQR"]`) đều có `boundingBox().y < 800` (cùng nằm trong màn đầu); viewport 390 → thứ tự cũ: phiếu nằm trên điểm danh.
  Run → FAIL.
- [ ] **Step 2: `TuitionNoticeCard`** — thêm `variant`. Khi `"wide"`: bỏ `style={{ width: 360 }}`, thêm `w-full`; không render 2 khối `dates` ("Ngày học"); khối QR đổi thành:
```tsx
<div data-testid="notice-qr-side" className="grid grid-cols-[160px_1fr] items-center gap-4 border-t border-slate-200 pt-3 text-left">
  {/* cùng <img> QR như bản thường nhưng width/height 160 */}
  <div className="space-y-1">{/* bank, số TK, chủ TK, số tiền, nội dung: cùng các <p> như bản thường */}</div>
</div>
```
  Bản `"default"` giữ nguyên từng dòng (phiếu ảnh Zalo dùng bản này).
- [ ] **Step 3: `ParentView`**
  - `const wide = useMediaQuery("(min-width: 1024px)")`.
  - Khung: `mx-auto max-w-md space-y-6 px-4 py-6 lg:max-w-6xl lg:px-8`.
  - Đầu trang: `header` thành `flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between`; bên trái giữ `h1` + 1 dòng `${t("grade")} ${grade} · ${t("teacher_fallback")}: ${teacherName}` trên `lg`, 2 dòng như cũ trên mobile (dùng `hidden lg:block` / `lg:hidden`); `nav` chuyển tháng đặt bên phải trên `lg` (`lg:min-w-[360px]`).
  - Thân: `<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">`:
    - Cột trái `<div className="space-y-6">`: section điểm danh (thêm lưới `grid grid-cols-3 gap-2` 3 ô `data-testid="parent-stat"`: Có mặt = present+late, Vắng = absent, Tổng buổi = `view.attendance.length`; nhãn i18n `parent_stat_present` "Có mặt", `parent_stat_absent` "Vắng", `parent_stat_total` "Tổng buổi") + section lịch sắp tới (giữ nguyên nội dung).
    - Cột phải `<aside className="order-first space-y-2 lg:order-last lg:sticky lg:top-4">`: phiếu (`variant={wide ? "wide" : "default"}`; bản default giữ khung `overflow-x-auto` + `w-fit` như cũ, bản wide không cần), gợi ý QR, `footer`.
  - Footer: trên mobile giữ cuối trang → 1 `footer` sau lưới với `lg:hidden`, 1 `footer` trong `aside` với `hidden lg:block`. Thứ tự mobile giữ như cũ: phiếu → điểm danh → lịch sắp tới → footer.
- [ ] **Step 4: `ParentLinkDialog`** — `<DialogContent className="sm:max-w-[640px]">`; khung nút `grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap`.
- [ ] **Step 5: i18n** 3 key ở Step 3 (en: "Present", "Absent", "Total sessions").
- [ ] **Step 6:** chạy test Task 7 + `tests/unit/components/TuitionNoticeDialog.test.tsx` (phiếu ảnh không đổi) → PASS; `pnpm exec playwright test tests/e2e/parent-link.spec.ts` → PASS. `tsc` + `lint`.
- [ ] **Step 7: Commit** `feat(y): trang phụ huynh 2 cột trên máy tính, modal link phụ huynh 4 nút một hàng`.

---

### Task 8: e2e luồng thu tiền + version 0.10.0

**Files:**
- Create: `tests/e2e/y-thu-hoc-phi.spec.ts`
- Modify: `tests/e2e/tuition-payments.spec.ts`, các e2e khác bấm "Ghi nhận"/"Thu tiền"/checkbox đã đóng đủ (`grep -rn "Ghi nhận\|Thu tiền\|Đánh dấu đã đóng đủ\|Chuyển khoản" tests/e2e`), `package.json`

- [ ] **Step 1: e2e mới** (đăng nhập `teacher`; dựng dữ liệu bằng Prisma trực tiếp sau khi kiểm endpoint test như `tests/e2e/admin.spec.ts`: 1 HS "E2E Y An" theo buổi 100k, tháng trước 8 buổi có mặt; HS "E2E Y Huy" nợ 2 tháng trước nữa 200k + tháng trước 600k; dọn bằng `hardDeleteStudents(studentIdsByNamePrefix(db, "E2E Y"))` từ `tests/e2e/helpers/db-cleanup.ts`):
  1. Vào `/tuition` (không tham số) → tiêu đề tháng là tháng trước; thấy "Đang xem tháng trước".
  2. Luồng 1: dòng "E2E Y An" bấm "Đã đóng đủ 800.000 đ" → toast "Đã ghi 800.000 đ" → dòng không còn nút; bấm "Hoàn tác" (test riêng) → nút trở lại.
  3. Luồng 2: mở chi tiết "E2E Y Huy" → "Đóng một phần" → gõ 500000 → thấy "Trừ vào T<m1>: 200.000 đ, T<m2>: 300.000 đ" → "Ghi nhận" → "Còn thiếu" 300.000 đ.
  4. Luồng 3: sang tháng hiện tại, chi tiết "E2E Y Huy" thấy "Tháng <m2> còn thiếu"; "Đóng một phần" 300000 → về tháng trước thấy HS "Đã đóng đủ".
  5. Không có checkbox "Đánh dấu đã đóng đủ" và chữ "Chuyển khoản" trong sheet.
- [ ] **Step 2:** sửa e2e cũ theo luồng mới (không giảm số kiểm; mỗi chỗ đổi ghi Ruling).
- [ ] **Step 3: Version** `package.json` → `"version": "0.10.0"`.
- [ ] **Step 4:** `pnpm exec tsc --noEmit && pnpm lint && pnpm test` → PASS toàn bộ; e2e đầy đủ 2 nửa → PASS (ghi số test).
- [ ] **Step 5: Commit** `test(y): e2e luồng thu học phí mới; v0.10.0`.

Báo cáo: số test, mọi `Ruling:`, danh sách e2e cũ đã sửa.
