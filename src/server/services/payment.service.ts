import { Prisma, type Payment, type PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { assertOwnership } from "./_base.service"
import { ensureMonthlyTuition } from "./tuition.service"
import type {
  PaymentCreateInput,
  PaymentListInput,
  PaymentMethod,
  PaymentUpdateData,
} from "@/lib/schemas/payment"
import type { PaymentDTO } from "@/lib/types/models"

function toDTO(p: Payment): PaymentDTO {
  return {
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt.toISOString().slice(0, 10),
    method: p.method as PaymentMethod,
    note: p.note,
  }
}

/**
 * HÀM DUY NHẤT được ghi MonthlyTuition.paidAmount (ngoài create paidAmount: 0 của snapshot).
 * Tính lại bằng aggregate, không cộng dồn, để không bao giờ lệch tổng Payment.
 */
export async function syncPaidAmount(tx: Prisma.TransactionClient, monthlyTuitionId: number): Promise<number> {
  const { _sum } = await tx.payment.aggregate({ where: { monthlyTuitionId }, _sum: { amount: true } })
  const paidAmount = _sum.amount ?? 0
  await tx.monthlyTuition.update({ where: { id: monthlyTuitionId }, data: { paidAmount } })
  return paidAmount
}

// Khoá dòng tháng: 2 lần ghi cùng lúc phải chờ nhau, nếu không SUM sẽ đọc thiếu lần kia.
async function lockMonth(tx: Prisma.TransactionClient, monthlyTuitionId: number) {
  await tx.$queryRaw`SELECT id FROM monthly_tuition WHERE id = ${monthlyTuitionId} FOR UPDATE`
}

// Request thứ 2 phải chờ transaction trước (khoá FOR UPDATE / pool ít kết nối); mặc định maxWait 2s, timeout 5s dễ quá hạn trên DB chậm.
const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 }

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
    include: { monthlyTuition: { select: { student: { select: { userId: true } } } } },
  })
  if (!payment || payment.monthlyTuition.student.userId !== userId) {
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
    await tx.payment.delete({ where: { id } })
    await syncPaidAmount(tx, existing.monthlyTuitionId)
  }, TX_OPTIONS).catch(rethrowNotFound)
  return { id }
}
