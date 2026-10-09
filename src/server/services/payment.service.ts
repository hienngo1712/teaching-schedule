import { Prisma, type Payment, type PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { randomUUID } from "node:crypto"
import { assertOwnership } from "./_base.service"
import { ensureMonthlyTuition, loadMonthLedgers } from "./tuition.service"
import { softDeleteData } from "@/server/soft-delete"
import { allocatePayment, keyToYearMonth } from "@/lib/payment-allocation"
import { vnTodayIso } from "@/lib/payment-summary"
import { monthKey } from "@/lib/billing"
import { isInProgressMonth } from "@/lib/tuition-display"
import type {
  PaymentCreateInput,
  PaymentListInput,
  PaymentRecordInput,
  StoredPaymentMethod,
  PaymentUpdateBatchInput,
  PaymentUpdateData,
} from "@/lib/schemas/payment"
import type { PaymentBatchDTO, PaymentDTO } from "@/lib/types/models"

const LEGACY = "legacy-"
// Khoá theo HS (khoá 2 số, không đụng khoá giới hạn gói 1 số theo userId): 2 lần ghi cùng HS phải chờ nhau.
const PAY_LOCK_NS = 7
async function lockStudentPayments(tx: Prisma.TransactionClient, studentId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PAY_LOCK_NS}::int, ${studentId}::int)`
}

async function writeAllocation(
  tx: Prisma.TransactionClient,
  userId: number,
  studentId: number,
  target: { year: number; month: number },
  amount: number,
  meta: { batchId: string; paidAt: string; note: string | null; method?: StoredPaymentMethod }
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
      data: { monthlyTuitionId: mt.id, amount: part.amount, paidAt: new Date(meta.paidAt), method: meta.method ?? "cash", note: meta.note, batchId: meta.batchId },
    })
    await syncPaidAmount(tx, mt.id)
    allocations.push({ ...ym, amount: part.amount })
  }
  return allocations
}

// Tạo trước dòng tháng (kèm carry-over đúng) cho các tháng dự kiến nhận tiền, ngoài transaction như createPayment.
// Không tạo cho cả lịch sử: mỗi ensure tính lại toàn bộ chuỗi số dư, quét hết sẽ chậm dần theo số tháng.
async function ensureLedgerMonths(db: PrismaClient, userId: number, studentId: number, year: number, month: number, amount: number) {
  const ledgers = await loadMonthLedgers(db, userId, studentId, year, month)
  for (const part of allocatePayment(ledgers, amount)) {
    const ym = keyToYearMonth(part.key)
    await ensureMonthlyTuition(db, userId, studentId, ym.year, ym.month)
  }
}

export async function recordPayment(db: PrismaClient, userId: number, input: PaymentRecordInput) {
  // Tháng chưa học xong (cả HS trọn tháng) không ghi tiền, tránh giáo viên tính nhầm; đóng trước thì ghi dư ở tháng trước.
  if (isInProgressMonth(input.year, input.month)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tháng này chưa học xong, hãy ghi khoản thu ở tháng trước" })
  }
  await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month) // kiểm quyền + HS còn sống
  await ensureLedgerMonths(db, userId, input.studentId, input.year, input.month, input.amount)
  const batchId = randomUUID()
  const allocations = await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, input.studentId)
    return writeAllocation(tx, userId, input.studentId, input, input.amount, {
      batchId, paidAt: input.paidAt ?? vnTodayIso(), note: input.note ?? null,
    })
  }, TX_OPTIONS)
  return { batchId, allocations }
}

// Lõi FIFO cho tiền payOS (spec AH §6): không chặn tháng đang học vì neo đã là tháng đã học xong.
export async function recordPaymentFromPayos(
  db: PrismaClient, userId: number, studentId: number,
  anchor: { year: number; month: number }, amount: number,
  meta: { paidAt: string; note: string },
  inTx: (tx: Prisma.TransactionClient, batchId: string) => Promise<void>
): Promise<{ batchId: string }> {
  await ensureMonthlyTuition(db, userId, studentId, anchor.year, anchor.month)
  await ensureLedgerMonths(db, userId, studentId, anchor.year, anchor.month, amount)
  const batchId = randomUUID()
  await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, studentId)
    await writeAllocation(tx, userId, studentId, anchor, amount, { batchId, paidAt: meta.paidAt, note: meta.note, method: "payos" })
    await inTx(tx, batchId)
  }, TX_OPTIONS)
  return { batchId }
}

function batchWhere(batchId: string) {
  return batchId.startsWith(LEGACY)
    ? { id: Number(batchId.slice(LEGACY.length)) || -1, batchId: null }
    : { batchId }
}

// Đọc lại dòng của đợt SAU khi giữ khoá HS: request khác có thể vừa xoá/sửa đợt này (dòng đọc ngoài khoá đã cũ).
async function lockedBatchRows(tx: Prisma.TransactionClient, batchId: string) {
  const rows = await tx.payment.findMany({ where: { ...batchWhere(batchId), isDeleted: false } })
  if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" })
  return rows
}

async function findBatchRows(db: PrismaClient | Prisma.TransactionClient, userId: number, batchId: string) {
  const rows = await db.payment.findMany({
    where: batchWhere(batchId),
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
  const own = await db.payment.findMany({ where: { monthlyTuition: { studentId, year, month } }, orderBy: [{ paidAt: "desc" }, { id: "desc" }] })
  const batchIds = [...new Set(own.map((p) => p.batchId).filter((b): b is string => b !== null))]
  const batched = batchIds.length
    ? await db.payment.findMany({ where: { batchId: { in: batchIds } }, include: { monthlyTuition: { select: { year: true, month: true } } }, orderBy: [{ paidAt: "desc" }, { id: "desc" }] })
    : []
  const groups = new Map<string, PaymentBatchDTO>()
  for (const p of batched) {
    const g = groups.get(p.batchId!) ?? { batchId: p.batchId!, amount: 0, paidAt: p.paidAt.toISOString().slice(0, 10), note: p.note, method: p.method as StoredPaymentMethod, allocations: [], legacy: false }
    g.amount += p.amount
    g.allocations.push({ year: p.monthlyTuition.year, month: p.monthlyTuition.month, amount: p.amount })
    groups.set(p.batchId!, g)
  }
  for (const p of own.filter((x) => x.batchId === null)) {
    groups.set(`${LEGACY}${p.id}`, {
      batchId: `${LEGACY}${p.id}`, amount: p.amount, paidAt: p.paidAt.toISOString().slice(0, 10), note: p.note, method: p.method as StoredPaymentMethod,
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
    for (const r of await lockedBatchRows(tx, batchId)) {
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
  await ensureLedgerMonths(db, userId, studentId, target.year, target.month, input.amount)
  await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, studentId)
    for (const r of await lockedBatchRows(tx, input.batchId)) {
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

function toDTO(p: Payment): PaymentDTO {
  return {
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt.toISOString().slice(0, 10),
    method: p.method as StoredPaymentMethod,
    note: p.note,
  }
}

/**
 * HÀM DUY NHẤT được ghi MonthlyTuition.paidAmount (ngoài create paidAmount: 0 của snapshot).
 * Tính lại bằng aggregate, không cộng dồn, để không bao giờ lệch tổng Payment.
 */
export async function syncPaidAmount(tx: Prisma.TransactionClient, monthlyTuitionId: number): Promise<number> {
  const { _sum } = await tx.payment.aggregate({ where: { monthlyTuitionId, isDeleted: false }, _sum: { amount: true } })
  const paidAmount = _sum.amount ?? 0
  await tx.monthlyTuition.update({ where: { id: monthlyTuitionId }, data: { paidAmount } })
  return paidAmount
}

// Khoá dòng tháng: 2 lần ghi cùng lúc phải chờ nhau, nếu không SUM sẽ đọc thiếu lần kia.
export async function lockMonth(tx: Prisma.TransactionClient, monthlyTuitionId: number) {
  await tx.$queryRaw`SELECT id FROM monthly_tuition WHERE id = ${monthlyTuitionId} FOR UPDATE`
}

// Request thứ 2 phải chờ transaction trước (khoá FOR UPDATE / pool ít kết nối); mặc định maxWait 2s, timeout 5s dễ quá hạn trên DB chậm.
export const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 }

// Lần thu bị xoá sau findOwnedPayment (request khác) → update/delete ném P2025; trả NOT_FOUND như không tìm thấy.
function rethrowNotFound(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  throw e
}

async function findOwnedPayment(db: PrismaClient, userId: number, id: number) {
  const payment = await db.payment.findUnique({
    where: { id },
    include: { monthlyTuition: { select: { student: { select: { userId: true, isDeleted: true } } } } },
  })
  if (!payment || payment.monthlyTuition.student.userId !== userId || payment.monthlyTuition.student.isDeleted) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return payment
}

export async function listPayments(
  db: PrismaClient,
  userId: number,
  { studentId, year, month }: PaymentListInput
): Promise<PaymentDTO[]> {
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)

  const rows = await db.payment.findMany({
    where: { monthlyTuition: { studentId, year, month } },
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
  })
  return rows.map(toDTO)
}

export async function createPayment(
  db: PrismaClient,
  userId: number,
  input: PaymentCreateInput
): Promise<PaymentDTO> {
  const mt = await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month)
  const created = await db.$transaction(async (tx) => {
    await lockMonth(tx, mt.id)
    const p = await tx.payment.create({
      data: {
        monthlyTuitionId: mt.id,
        amount: input.amount,
        paidAt: new Date(input.paidAt),
        method: input.method,
        note: input.note ?? null,
      },
    })
    await syncPaidAmount(tx, mt.id)
    return p
  }, TX_OPTIONS)
  return toDTO(created)
}

// Không cho chuyển sang tháng khác (spec S6): muốn đổi tháng thì xoá rồi thêm lại.
export async function updatePayment(
  db: PrismaClient,
  userId: number,
  id: number,
  data: PaymentUpdateData
): Promise<PaymentDTO> {
  const existing = await findOwnedPayment(db, userId, id)
  const updated = await db.$transaction(async (tx) => {
    await lockMonth(tx, existing.monthlyTuitionId)
    const p = await tx.payment.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.paidAt !== undefined && { paidAt: new Date(data.paidAt) }),
        ...(data.method !== undefined && { method: data.method }),
        ...(data.note !== undefined && { note: data.note }),
      },
    })
    await syncPaidAmount(tx, existing.monthlyTuitionId)
    return p
  }, TX_OPTIONS).catch(rethrowNotFound)
  return toDTO(updated)
}

export async function deletePayment(db: PrismaClient, userId: number, id: number): Promise<{ id: number }> {
  const existing = await findOwnedPayment(db, userId, id)
  await db.$transaction(async (tx) => {
    await lockMonth(tx, existing.monthlyTuitionId)
    await tx.payment.update({ where: { id }, data: softDeleteData() })
    await syncPaidAmount(tx, existing.monthlyTuitionId)
  }, TX_OPTIONS).catch(rethrowNotFound)
  return { id }
}
