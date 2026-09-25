import { db } from "@/server/db"

// Truy vấn (C) spec B §8.3: tháng nào có paidAmount lệch tổng Payment. Rỗng = bất biến đúng.
export async function findPaidAmountMismatches() {
  return db.$queryRaw<Array<{ id: number; paid_amount: number; s: bigint }>>`
    SELECT mt."id", mt."paid_amount", COALESCE(SUM(p."amount"), 0) AS s
    FROM "monthly_tuition" mt LEFT JOIN "payments" p ON p."monthly_tuition_id" = mt."id"
    GROUP BY mt."id"
    HAVING mt."paid_amount" <> COALESCE(SUM(p."amount"), 0)`
}
