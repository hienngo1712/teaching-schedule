// Thuần, dùng chung client/server: doanh thu gói theo tháng của ngày duyệt giờ VN (spec K nhóm C).
import { isPaidPlan, isPeriod, type PaidPlan, type Period } from "@/lib/plans"
import { vnDateParts } from "@/lib/utils"

export type YearMonth = { year: number; month: number }
export type RevenueKind = "new" | "renew" | "upgrade"
export const REVENUE_KINDS: readonly RevenueKind[] = ["new", "renew", "upgrade"]
export type RevenueBucket = { amount: number; count: number }
export type RevenueStats = {
  total: RevenueBucket
  byKind: Record<RevenueKind, RevenueBucket>
  byPlan: Record<PaidPlan, RevenueBucket>
  byPeriod: Record<Period, RevenueBucket>
}
export type RevenueMonth = YearMonth & RevenueStats
export type RevenueReport = { months: RevenueMonth[]; summary: RevenueStats }
export type RevenueOrder = {
  id: number
  userId: number
  plan: string
  period: string | null
  amount: number
  creditDays: number
  decidedAt: Date
}
export type RevenueFilter =
  | { mode: "month"; year: number; month: number }
  | { mode: "range"; from: YearMonth; to: YearMonth }
  | { mode: "year"; year: number }

export const REVENUE_MAX_MONTHS = 36
// Năm ra mắt phân gói: không có đơn trước đó.
export const REVENUE_FIRST_YEAR = 2026

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export function vnMonthStart({ year, month }: YearMonth): Date {
  return new Date(Date.UTC(year, month - 1, 1) - VN_OFFSET_MS)
}

export function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + month - 1
}

function fromIndex(i: number): YearMonth {
  return { year: Math.floor(i / 12), month: (i % 12) + 1 }
}

export function nextMonth(ym: YearMonth): YearMonth {
  return fromIndex(monthIndex(ym) + 1)
}

export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = []
  for (let i = monthIndex(from); i <= monthIndex(to); i++) out.push(fromIndex(i))
  return out
}

export function filterToRange(f: RevenueFilter): { from: YearMonth; to: YearMonth } {
  if (f.mode === "month") return { from: { year: f.year, month: f.month }, to: { year: f.year, month: f.month } }
  if (f.mode === "year") return { from: { year: f.year, month: 1 }, to: { year: f.year, month: 12 } }
  return { from: f.from, to: f.to }
}

export function rangeError(from: YearMonth, to: YearMonth): "order" | "too_long" | null {
  const span = monthIndex(to) - monthIndex(from) + 1
  if (span < 1) return "order"
  return span > REVENUE_MAX_MONTHS ? "too_long" : null
}

const bucket = (): RevenueBucket => ({ amount: 0, count: 0 })

export function emptyStats(): RevenueStats {
  return {
    total: bucket(),
    byKind: { new: bucket(), renew: bucket(), upgrade: bucket() },
    byPlan: { plus: bucket(), pro: bucket() },
    byPeriod: { month: bucket(), year: bucket(), "2year": bucket() },
  }
}

type CountedOrder = RevenueOrder & { plan: PaidPlan; period: Period }

// Cột plan/period là VARCHAR: giá trị lạ hoặc đơn 0đ (tặng, admin đặt tay) không cộng và không tính là "đã mua".
function isCounted(o: RevenueOrder): o is CountedOrder {
  return o.amount > 0 && isPaidPlan(o.plan) && isPeriod(o.period)
}

export function classifyOrders(orders: RevenueOrder[]): Map<number, RevenueKind> {
  const kinds = new Map<number, RevenueKind>()
  const paidUsers = new Set<number>()
  const sorted = orders.filter(isCounted).sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime() || a.id - b.id)
  for (const o of sorted) {
    // creditDays > 0 chỉ có khi Plus trả phí còn hạn lên Pro (D7) → nhóm Nâng cấp riêng (spec K C4).
    kinds.set(o.id, o.plan === "pro" && o.creditDays > 0 ? "upgrade" : paidUsers.has(o.userId) ? "renew" : "new")
    paidUsers.add(o.userId)
  }
  return kinds
}

function addTo(s: RevenueStats, o: CountedOrder, kind: RevenueKind) {
  for (const b of [s.total, s.byKind[kind], s.byPlan[o.plan], s.byPeriod[o.period]]) {
    b.amount += o.amount
    b.count += 1
  }
}

// orders phải gồm cả đơn TRƯỚC khoảng để phân loại mới/gia hạn đúng (spec K C3, C6).
export function buildRevenueReport(orders: RevenueOrder[], from: YearMonth, to: YearMonth): RevenueReport {
  const kinds = classifyOrders(orders)
  const months: RevenueMonth[] = monthsBetween(from, to).map((ym) => ({ ...ym, ...emptyStats() }))
  const summary = emptyStats()
  const start = monthIndex(from)
  for (const o of orders) {
    const kind = kinds.get(o.id)
    if (!kind || !isCounted(o)) continue
    const { year, month } = vnDateParts(o.decidedAt)
    const row = months[monthIndex({ year, month }) - start]
    if (!row) continue
    addTo(row, o, kind)
    addTo(summary, o, kind)
  }
  return { months, summary }
}
