import { describe, it, expect, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getMonthlyPrices, getPlanPrices, getPriceHistory } from "@/server/services/plan-price.service"

// tests/setup.ts không xóa bảng giá: dọn dòng test để giá về 49.000/99.000 cho file khác.
async function resetPrices() {
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPrices()
})

describe("plan-price.service (đọc)", () => {
  it("giá seed 49.000/99.000, đủ 3 kỳ", async () => {
    expect(await getMonthlyPrices(db)).toEqual({ plus: 49000, pro: 99000 })
    expect(await getPlanPrices(db)).toEqual({
      plus: { month: 49000, year: 490000, "2year": 980000 },
      pro: { month: 99000, year: 990000, "2year": 1980000 },
    })
  })

  it("giá hiện hành = dòng mới nhất của từng gói; lịch sử mới nhất trước, gồm dòng seed", async () => {
    await db.planPriceChange.create({ data: { plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "price_test" } })
    await db.planPriceChange.create({ data: { plan: "plus", monthPrice: 59900, previousMonthPrice: 59000, changedBy: "price_test" } })
    expect(await getMonthlyPrices(db)).toEqual({ plus: 59900, pro: 99000 })
    const history = await getPriceHistory(db)
    expect(history.slice(0, 2).map((r) => [r.plan, r.previousMonthPrice, r.monthPrice, r.changedBy])).toEqual([
      ["plus", 59000, 59900, "price_test"],
      ["plus", 49000, 59000, "price_test"],
    ])
    expect(history.filter((r) => r.changedBy === "migration")).toHaveLength(2)
    expect(history[0].createdAt).toBeInstanceOf(Date)
  })

  it("thiếu dòng của 1 gói → giá mặc định + console.warn (trong transaction rồi rollback để giữ dòng seed)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(
      db.$transaction(async (tx) => {
        await tx.planPriceChange.create({ data: { plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "price_test" } })
        await tx.planPriceChange.deleteMany({ where: { plan: "pro" } })
        expect(await getMonthlyPrices(tx)).toEqual({ plus: 59000, pro: 99000 })
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")
    expect(warn).toHaveBeenCalledWith("[plan-price] thiếu giá pro, dùng mặc định")
    expect(await db.planPriceChange.count({ where: { plan: "pro", changedBy: "migration" } })).toBe(1)
  })
})
