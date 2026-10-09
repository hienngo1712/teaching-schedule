import { Prisma, type PrismaClient } from "@prisma/client"
import { parsePayosDateTime, verifyWebhookSignature } from "@/server/payos"
import { recordPaymentFromPayos } from "./payment.service"
import { vnTodayIso } from "@/lib/payment-summary"

type Data = { orderCode?: unknown; amount?: unknown; reference?: unknown; transactionDateTime?: unknown; paymentLinkId?: unknown; code?: unknown }

export async function handleTuitionWebhook(db: PrismaClient, hookId: string, body: unknown): Promise<{ status: 200 | 400 | 401 | 404; note?: string }> {
  const b = body as { data?: Data & Record<string, unknown>; signature?: unknown } | null
  if (!b || typeof b.data !== "object" || b.data === null || typeof b.signature !== "string") return { status: 400 }
  const teacher = await db.teacherPayos.findUnique({ where: { hookId } })
  if (!teacher) return { status: 404 }
  if (!verifyWebhookSignature(teacher.checksumKey, b.data, b.signature)) return { status: 401 }
  const d = b.data
  if (d.code !== "00" || typeof d.orderCode !== "number" || typeof d.amount !== "number" || typeof d.reference !== "string") return { status: 200, note: "bỏ qua" }
  // Giao dịch thử lúc confirm-webhook (orderCode 123) hay link của GV khác: không khớp thì bỏ qua.
  const link = await db.tuitionPayLink.findUnique({ where: { id: d.orderCode }, include: { student: { select: { isDeleted: true } } } })
  if (!link || link.userId !== teacher.userId || link.payosLinkId !== d.paymentLinkId) return { status: 200, note: "không khớp" }
  if (link.student.isDeleted) {
    console.warn(`[payos] tiền HP vào HS đã xoá, link ${link.id}`)
    return { status: 200, note: "HS đã xoá" }
  }
  if (await db.tuitionPayLinkPayment.findUnique({ where: { reference: d.reference }, select: { id: true } })) return { status: 200, note: "gửi lặp" }
  const parsed = typeof d.transactionDateTime === "string" ? parsePayosDateTime(d.transactionDateTime) : null
  // Ngày hỏng mà ném lỗi thì payOS gửi lại mãi, tiền không bao giờ được ghi: lấy giờ nhận.
  const paidAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date()
  const reference = d.reference
  const amount = d.amount
  try {
    await recordPaymentFromPayos(db, link.userId, link.studentId, { year: link.year, month: link.month }, amount,
      { paidAt: vnTodayIso(paidAt), note: `payOS · ${reference}` },
      async (tx, batchId) => {
        await tx.tuitionPayLinkPayment.create({ data: { linkId: link.id, reference, amount, paidAt, batchId } })
        if (link.status === "active") await tx.tuitionPayLink.update({ where: { id: link.id }, data: { status: "paid" } })
        const where = { studentId_year_month: { studentId: link.studentId, year: link.year, month: link.month } }
        // Cột null thì increment ra NULL (NULL + x) → đọc rồi cộng trong cùng transaction (đang giữ khoá HS).
        const cur = await tx.monthlyTuition.findUniqueOrThrow({ where, select: { payosPaidAmount: true } })
        await tx.monthlyTuition.update({ where, data: { payosPaidAt: paidAt, payosPaidAmount: (cur.payosPaidAmount ?? 0) + amount } })
      })
  } catch (e) {
    // 2 lần gửi cùng lúc: lần sau đụng unique reference → coi như gửi lặp.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: 200, note: "gửi lặp" }
    throw e
  }
  return { status: 200, note: "đã ghi" }
}
