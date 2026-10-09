import type { PrismaClient } from "@prisma/client"

// "PH đã chuyển" tính lúc đọc từ các đợt payOS còn sống: xoá/khôi phục đợt thu tự đúng, không phải nhớ cập nhật cột nào.
export async function loadPayosPaid(
  db: PrismaClient, studentIds: number[], year: number, month: number
): Promise<Map<number, { at: Date; amount: number }>> {
  const rows = await db.tuitionPayLinkPayment.findMany({
    where: { link: { studentId: { in: studentIds }, year, month } },
    select: { amount: true, paidAt: true, batchId: true, link: { select: { studentId: true } } },
  })
  const result = new Map<number, { at: Date; amount: number }>()
  if (rows.length === 0) return result
  const live = await db.payment.findMany({
    where: { batchId: { in: rows.map((r) => r.batchId) }, isDeleted: false },
    select: { batchId: true },
    distinct: ["batchId"],
  })
  const liveIds = new Set(live.map((p) => p.batchId))
  for (const r of rows) {
    if (!liveIds.has(r.batchId)) continue
    const cur = result.get(r.link.studentId)
    result.set(r.link.studentId, {
      at: cur && cur.at > r.paidAt ? cur.at : r.paidAt,
      amount: (cur?.amount ?? 0) + r.amount,
    })
  }
  return result
}
