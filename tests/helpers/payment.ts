import { db } from "@/server/db"
import type { getAuthedCaller } from "./trpc"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

// Truy vấn (C) spec B §8.3: tháng nào có paidAmount lệch tổng Payment. Rỗng = bất biến đúng.
export async function findPaidAmountMismatches() {
  return db.$queryRaw<Array<{ id: number; paid_amount: number; s: bigint }>>`
    SELECT mt."id", mt."paid_amount", COALESCE(SUM(p."amount"), 0) AS s
    FROM "monthly_tuition" mt LEFT JOIN "payments" p ON p."monthly_tuition_id" = mt."id"
    GROUP BY mt."id"
    HAVING mt."paid_amount" <> COALESCE(SUM(p."amount"), 0)`
}

// Thay cho tuition.updatePayment cũ trong test: 1 lần thu (nếu amount > 0) + tất toán (nếu cần).
export async function recordPayment(
  caller: Caller,
  p: { studentId: number; year: number; month: number; amount: number; isFullPaid?: boolean }
) {
  const { studentId, year, month, amount, isFullPaid } = p
  if (amount > 0) {
    await caller.payment.create({
      studentId,
      year,
      month,
      amount,
      method: "cash",
      paidAt: `${year}-${String(month).padStart(2, "0")}-15`,
    })
  }
  if (isFullPaid) {
    await caller.tuition.updateSettlement({ studentId, year, month, isFullPaid: true })
  }
}
