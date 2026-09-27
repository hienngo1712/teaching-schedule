import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import type { UpdatePricesInput } from "@/lib/schemas/plan"
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

// Khóa 2 tham số int ở không gian khóa riêng của Postgres, không đụng khóa 1 tham số theo userId (createOrder/approveOrder).
// Khóa thứ 2: 0 = bảng giá, 1 = số ngày dùng thử mặc định.
export const SETTINGS_LOCK_CLASS = 7401
const PRICE_LOCK_KEY = 0

export async function updatePrices(db: PrismaClient, admin: string, input: UpdatePricesInput): Promise<{ changed: PaidPlan[] }> {
  const { changed, current } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETTINGS_LOCK_CLASS}::int, ${PRICE_LOCK_KEY}::int)`
    const current = await getMonthlyPrices(tx)
    // So với giá admin đang thấy: 2 tab/2 admin Lưu cùng lúc thì lần sau bị chặn, lịch sử luôn liền mạch cũ → mới (spec L Q9).
    if (current.plus !== input.expected.plus || current.pro !== input.expected.pro) {
      throw new TRPCError({ code: "CONFLICT", message: "Bảng giá vừa được đổi ở nơi khác, tải lại để xem" })
    }
    const changed = PAID_PLANS.filter((p) => input.prices[p] !== current[p])
    if (changed.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Giá chưa thay đổi" })
    if (input.prices.pro <= input.prices.plus) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Giá Pro phải cao hơn giá Plus" })
    }
    await tx.planPriceChange.createMany({
      data: changed.map((plan) => ({ plan, monthPrice: input.prices[plan], previousMonthPrice: current[plan], changedBy: admin })),
    })
    return { changed, current }
  })
  console.info(`[admin] ${admin} đổi giá ${changed.map((p) => `${p} ${current[p]}→${input.prices[p]}`).join(", ")}`)
  return { changed }
}
