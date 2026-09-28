import { PERIODS } from "@/lib/plans"
import { buildRevenueReport, nextMonth, vnMonthStart, type RevenueReport } from "@/lib/revenue"
import type { RevenueQueryInput } from "@/lib/schemas/plan"
import type { Db } from "./plan.service"

// Lấy cả đơn trước khoảng lọc để phân loại mới/gia hạn (spec K C6); vài trăm đơn/năm nên gom trong JS.
export async function getRevenue(db: Db, input: RevenueQueryInput): Promise<RevenueReport> {
  const rows = await db.planOrder.findMany({
    where: {
      status: "approved",
      source: "user",
      amount: { gt: 0 },
      plan: { in: ["plus", "pro"] },
      period: { in: [...PERIODS] },
      // Không lọc tài khoản đã xóa mềm: tiền đã nhận, doanh thu quá khứ không đổi (spec K K16).
      decidedAt: { not: null, lt: vnMonthStart(nextMonth(input.to)) },
    },
    select: { id: true, userId: true, plan: true, period: true, amount: true, creditDays: true, decidedAt: true },
  })
  const orders = rows.flatMap((r) => (r.decidedAt ? [{ ...r, decidedAt: r.decidedAt }] : []))
  return buildRevenueReport(orders, input.from, input.to)
}
