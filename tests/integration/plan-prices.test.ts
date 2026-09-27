import { describe, it, expect, afterEach, afterAll, beforeEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { getMonthlyPrices, getPlanPrices, getPriceHistory, updatePrices } from "@/server/services/plan-price.service"

// tests/setup.ts không xóa bảng giá: dọn dòng test để giá về 49.000/99.000 cho file khác.
async function resetPrices() {
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPrices()
})
beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
})
afterAll(() => {
  delete process.env.ADMIN_USERNAMES
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

  it("giá hiện hành = dòng id lớn nhất dù createdAt sớm hơn (spec P L3)", async () => {
    await db.planPriceChange.create({
      data: { plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "test-p-l3", createdAt: new Date("2000-01-01T00:00:00Z") },
    })
    expect((await getMonthlyPrices(db)).plus).toBe(59000)
  })
})

describe("admin.prices / admin.updatePrices", () => {
  const expected = { plus: 49000, pro: 99000 }
  const testRows = () => db.planPriceChange.findMany({ where: { changedBy: { not: "migration" } }, orderBy: { id: "asc" } })

  it("giáo viên → FORBIDDEN cả 2 procedure", async () => {
    const t = await getAuthedCaller("teacher_std")
    await expect(t.admin.prices()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected })).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(await testRows()).toHaveLength(0)
  })

  it("admin xem: monthly 49.000/99.000, lịch sử có 2 dòng seed", async () => {
    const r = await (await getAuthedCaller("admin_test")).admin.prices()
    expect(r.monthly).toEqual(expected)
    const seed = r.history.filter((h) => h.changedBy === "migration").map((h) => [h.plan, h.monthPrice, h.previousMonthPrice])
    expect(seed.sort()).toEqual([
      ["plus", 49000, null],
      ["pro", 99000, null],
    ])
  })

  it("đổi Plus 59.000 (Pro giữ) → 1 dòng, changedBy từ session; plan.me thấy giá mới", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected })).resolves.toEqual({ changed: ["plus"] })
    const rows = await testRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "admin_test" })
    expect((await (await getAuthedCaller("teacher_std")).plan.me()).prices.plus).toEqual({ month: 59000, year: 590000, "2year": 1180000 })
    expect((await admin.admin.prices()).monthly).toEqual({ plus: 59000, pro: 99000 })
  })

  it("giá lẻ, đổi cả 2 gói → 2 dòng cùng lần Lưu", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: { plus: 49900, pro: 129000 }, expected })).resolves.toEqual({ changed: ["plus", "pro"] })
    expect((await testRows()).map((r) => [r.plan, r.previousMonthPrice, r.monthPrice])).toEqual([
      ["plus", 49000, 49900],
      ["pro", 99000, 129000],
    ])
  })

  it("expected sai → CONFLICT, không thêm dòng", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected: { plus: 45000, pro: 99000 } })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Bảng giá vừa được đổi ở nơi khác, tải lại để xem",
    })
    expect(await testRows()).toHaveLength(0)
  })

  it("không đổi gì → BAD_REQUEST Giá chưa thay đổi", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: expected, expected })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Giá chưa thay đổi" })
    expect(await testRows()).toHaveLength(0)
  })

  it("ngoài khoảng / không nguyên / Pro ≤ Plus → BAD_REQUEST (zod); service tự chặn Pro ≤ Plus khi bỏ qua zod", async () => {
    const admin = await getAuthedCaller("admin_test")
    for (const prices of [{ plus: 9000, pro: 99000 }, { plus: 49000, pro: 1001000 }, { plus: 49900.5, pro: 99000 }, { plus: 99000, pro: 99000 }]) {
      await expect(admin.admin.updatePrices({ prices, expected })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }
    await expect(updatePrices(db, "admin_test", { prices: { plus: 99000, pro: 99000 }, expected })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Giá Pro phải cao hơn giá Plus",
    })
    expect(await testRows()).toHaveLength(0)
  })

  it("Review Focus 2: 2 lần Lưu cùng lúc cùng expected → đúng 1 thành công, lần kia CONFLICT, lịch sử 1 dòng", async () => {
    const admin = await getAuthedCaller("admin_test")
    const input = { prices: { plus: 59000, pro: 99000 }, expected }
    const results = await Promise.allSettled([admin.admin.updatePrices(input), admin.admin.updatePrices(input)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" })
    expect(await testRows()).toHaveLength(1)
  })
})
