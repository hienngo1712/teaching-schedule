import { DEFAULT_MONTH_PRICES, pricesFromMonthly, type PaidPlan, type PlanPrices } from "@/lib/plans"
import type { Db } from "./plan.service"

const PAID_PLANS: PaidPlan[] = ["plus", "pro"]

async function latestMonthPrice(db: Db, plan: PaidPlan): Promise<number> {
  const row = await db.planPriceChange.findFirst({
    where: { plan },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { monthPrice: true },
  })
  if (row) return row.monthPrice
  // DB dựng thiếu seed (db push, xóa tay): vẫn bán theo giá mặc định thay vì lỗi 500 (spec L Q4).
  console.warn(`[plan-price] thiếu giá ${plan}, dùng mặc định`)
  return DEFAULT_MONTH_PRICES[plan]
}

// Nhận cả tx để createOrder đọc giá trong cùng transaction tạo đơn.
export async function getMonthlyPrices(db: Db): Promise<Record<PaidPlan, number>> {
  const [plus, pro] = await Promise.all(PAID_PLANS.map((p) => latestMonthPrice(db, p)))
  return { plus, pro }
}

export async function getPlanPrices(db: Db): Promise<PlanPrices> {
  return pricesFromMonthly(await getMonthlyPrices(db))
}

export type PriceChangeRow = {
  id: number
  plan: string
  monthPrice: number
  previousMonthPrice: number | null
  changedBy: string
  createdAt: Date
}

// Giá đổi vài lần/tháng nên 50 dòng đủ vài năm, chưa phân trang (spec L Q15).
export async function getPriceHistory(db: Db): Promise<PriceChangeRow[]> {
  return db.planPriceChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, plan: true, monthPrice: true, previousMonthPrice: true, changedBy: true, createdAt: true },
  })
}
