import type { Prisma, PrismaClient } from "@prisma/client"
import { PER_SESSION, type Billing, type BillingChange, type BillingMode } from "@/lib/billing"

// Tải lịch sử cách thu của danh sách học sinh, gom theo studentId
export async function loadBillingChanges(
  db: PrismaClient | Prisma.TransactionClient,
  studentIds: number[]
): Promise<Map<number, BillingChange[]>> {
  const map = new Map<number, BillingChange[]>()
  if (studentIds.length === 0) return map

  const rows = await db.studentBillingChange.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { fromKey: "asc" },
  })

  for (const r of rows) {
    const list = map.get(r.studentId) ?? []
    list.push({
      fromKey: r.fromKey,
      mode: r.mode as BillingMode,
      monthlyFee: r.monthlyFee,
    })
    map.set(r.studentId, list)
  }

  return map
}

// Ghi lịch sử cách thu: upsert dòng fromKey; nếu trùng dòng trước thì xoá (spec T 3)
export async function recordBillingChange(
  tx: Prisma.TransactionClient,
  studentId: number,
  fromKey: number,
  next: Billing
): Promise<void> {
  const mode = next.mode
  const monthlyFee = next.mode === "per_session" ? 0 : next.monthlyFee

  await tx.studentBillingChange.upsert({
    where: { studentId_fromKey: { studentId, fromKey } },
    create: { studentId, fromKey, mode, monthlyFee },
    update: { mode, monthlyFee },
  })

  const prev = await tx.studentBillingChange.findFirst({
    where: { studentId, fromKey: { lt: fromKey } },
    orderBy: { fromKey: "desc" },
  })

  const prevBilling: Billing = prev
    ? { mode: prev.mode as BillingMode, monthlyFee: prev.monthlyFee }
    : PER_SESSION

  // Đổi rồi đổi về như tháng trước -> dòng tháng này thừa (xoá để tránh lịch sử rác)
  if (prevBilling.mode === mode && prevBilling.monthlyFee === monthlyFee) {
    await tx.studentBillingChange.delete({
      where: { studentId_fromKey: { studentId, fromKey } },
    })
  }
}
