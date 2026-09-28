import { describe, it, expect } from "vitest"
import {
  buildRevenueReport,
  classifyOrders,
  filterToRange,
  monthsBetween,
  nextMonth,
  rangeError,
  vnMonthStart,
  type RevenueOrder,
  type RevenueStats,
} from "@/lib/revenue"

let seq = 0
function order(p: Omit<Partial<RevenueOrder>, "decidedAt"> & { decidedAt: string }): RevenueOrder {
  seq += 1
  return { id: seq, userId: 1, plan: "plus", period: "month", amount: 49000, creditDays: 0, ...p, decidedAt: new Date(p.decidedAt) }
}
const sum = (r: Record<string, { amount: number; count: number }>) =>
  Object.values(r).reduce((a, b) => ({ amount: a.amount + b.amount, count: a.count + b.count }), { amount: 0, count: 0 })

describe("biên tháng giờ VN", () => {
  it("vnMonthStart = 00:00 ngày 1 giờ VN (17:00 UTC hôm trước)", () => {
    expect(vnMonthStart({ year: 2026, month: 10 })).toEqual(new Date("2026-09-30T17:00:00.000Z"))
    expect(vnMonthStart({ year: 2027, month: 1 })).toEqual(new Date("2026-12-31T17:00:00.000Z"))
  })
  it("nextMonth qua năm; monthsBetween gồm 2 đầu", () => {
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 })
    expect(monthsBetween({ year: 2026, month: 11 }, { year: 2027, month: 2 })).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ])
    expect(monthsBetween({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toEqual([{ year: 2026, month: 5 }])
  })
})

describe("filterToRange / rangeError (spec K C7)", () => {
  it("3 chế độ", () => {
    expect(filterToRange({ mode: "month", year: 2026, month: 10 })).toEqual({ from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } })
    expect(filterToRange({ mode: "year", year: 2026 })).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 12 } })
    const from = { year: 2026, month: 3 }
    const to = { year: 2027, month: 2 }
    expect(filterToRange({ mode: "range", from, to })).toEqual({ from, to })
  })
  it("ngược → order; đúng 36 tháng → null; 37 → too_long", () => {
    expect(rangeError({ year: 2026, month: 5 }, { year: 2026, month: 3 })).toBe("order")
    expect(rangeError({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBeNull()
    expect(rangeError({ year: 2026, month: 1 }, { year: 2028, month: 12 })).toBeNull()
    expect(rangeError({ year: 2026, month: 1 }, { year: 2029, month: 1 })).toBe("too_long")
  })
})

describe("classifyOrders (spec K C3–C5)", () => {
  it("mới → gia hạn → nâng cấp (Pro có creditDays) → gia hạn; user khác độc lập", () => {
    const a1 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const a2 = order({ decidedAt: "2026-02-05T03:00:00Z", period: "year", amount: 490000 })
    const a3 = order({ decidedAt: "2026-03-05T03:00:00Z", plan: "pro", period: "year", amount: 990000, creditDays: 120 })
    const a4 = order({ decidedAt: "2026-04-05T03:00:00Z", plan: "pro", period: "month", amount: 99000 })
    const b1 = order({ userId: 2, decidedAt: "2026-02-10T03:00:00Z", plan: "pro", period: "month", amount: 99000 })
    const k = classifyOrders([a4, b1, a3, a1, a2])
    expect([k.get(a1.id), k.get(a2.id), k.get(a3.id), k.get(a4.id), k.get(b1.id)]).toEqual(["new", "renew", "upgrade", "renew", "new"])
  })
  it("Pro không quy đổi (creditDays 0) sau khi Plus hết hạn → gia hạn", () => {
    const a1 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const a2 = order({ decidedAt: "2026-03-05T03:00:00Z", plan: "pro", period: "year", amount: 990000 })
    expect(classifyOrders([a1, a2]).get(a2.id)).toBe("renew")
  })
  it("cùng decidedAt → id nhỏ hơn là đơn trước", () => {
    const a1 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const a2 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const k = classifyOrders([a2, a1])
    expect([k.get(a1.id), k.get(a2.id)]).toEqual(["new", "renew"])
  })
  it("đơn 0đ / plan lạ / period null bị bỏ và không tính là đã mua", () => {
    const gift = order({ decidedAt: "2026-01-01T03:00:00Z", plan: "pro", period: null, amount: 0 })
    const zero = order({ decidedAt: "2026-01-02T03:00:00Z", amount: 0 })
    const odd = order({ decidedAt: "2026-01-03T03:00:00Z", plan: "gold" })
    const first = order({ decidedAt: "2026-02-01T03:00:00Z" })
    const k = classifyOrders([gift, zero, odd, first])
    expect(k.has(gift.id) || k.has(zero.id) || k.has(odd.id)).toBe(false)
    expect(k.get(first.id)).toBe("new")
  })
})

describe("buildRevenueReport", () => {
  const range = { from: { year: 2026, month: 10 }, to: { year: 2026, month: 12 } }

  it("biên tháng: 23:30 ngày 31/10 giờ VN vào tháng 10, 00:10 ngày 1/11 giờ VN vào tháng 11", () => {
    const r = buildRevenueReport(
      [
        order({ userId: 1, decidedAt: "2026-10-31T16:30:00Z" }),
        order({ userId: 2, decidedAt: "2026-10-31T17:10:00Z", plan: "pro", amount: 99000 }),
      ],
      range.from,
      range.to
    )
    expect(r.months.map((m) => [m.month, m.total.amount, m.total.count])).toEqual([
      [10, 49000, 1],
      [11, 99000, 1],
      [12, 0, 0],
    ])
  })

  it("đơn trước khoảng không cộng nhưng làm đơn trong khoảng thành gia hạn; đơn sau khoảng bỏ", () => {
    const r = buildRevenueReport(
      [
        order({ decidedAt: "2026-09-15T03:00:00Z" }),
        order({ decidedAt: "2026-10-15T03:00:00Z", period: "year", amount: 490000 }),
        order({ decidedAt: "2027-01-02T03:00:00Z" }),
      ],
      range.from,
      range.to
    )
    expect(r.summary.total).toEqual({ amount: 490000, count: 1 })
    expect(r.summary.byKind.renew).toEqual({ amount: 490000, count: 1 })
    expect(r.summary.byKind.new).toEqual({ amount: 0, count: 0 })
    expect(r.months).toHaveLength(3)
  })

  it("tổng các nhóm khớp total; summary = cộng các tháng", () => {
    const r = buildRevenueReport(
      [
        order({ userId: 1, decidedAt: "2026-10-05T03:00:00Z" }),
        order({ userId: 1, decidedAt: "2026-11-05T03:00:00Z", plan: "pro", period: "year", amount: 990000, creditDays: 30 }),
        order({ userId: 2, decidedAt: "2026-11-06T03:00:00Z", plan: "pro", period: "2year", amount: 1980000 }),
        order({ userId: 2, decidedAt: "2026-12-06T03:00:00Z", period: "year", amount: 490000 }),
      ],
      range.from,
      range.to
    )
    const s: RevenueStats = r.summary
    expect(s.total).toEqual({ amount: 3509000, count: 4 })
    for (const part of [s.byKind, s.byPlan, s.byPeriod]) expect(sum(part)).toEqual(s.total)
    expect(s.byKind).toEqual({ new: { amount: 2029000, count: 2 }, renew: { amount: 490000, count: 1 }, upgrade: { amount: 990000, count: 1 } })
    expect(s.byPlan).toEqual({ plus: { amount: 539000, count: 2 }, pro: { amount: 2970000, count: 2 } })
    expect(s.byPeriod).toEqual({ month: { amount: 49000, count: 1 }, year: { amount: 1480000, count: 2 }, "2year": { amount: 1980000, count: 1 } })
    expect(sum(Object.fromEntries(r.months.map((m) => [m.month, m.total])))).toEqual(s.total)
  })
})
