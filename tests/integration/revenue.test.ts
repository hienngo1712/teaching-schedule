import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const USERS = ["teacher_std", "admin_test"]
let a = 0
let b = 0

async function reset() {
  await db.planOrder.deleteMany({ where: { user: { username: { in: USERS } } } })
}

type Seed = { userId: number; plan: string; period: string | null; amount: number; status: string; source?: string; creditDays?: number; decidedAt: string | null }
async function seed(rows: Seed[]) {
  for (const r of rows) {
    await db.planOrder.create({
      data: {
        userId: r.userId,
        plan: r.plan,
        period: r.period,
        amount: r.amount,
        status: r.status,
        source: r.source ?? "user",
        creditDays: r.creditDays ?? 0,
        decidedAt: r.decidedAt ? new Date(r.decidedAt) : null,
        decidedBy: r.decidedAt ? "admin_test" : null,
      },
    })
  }
}

beforeAll(async () => {
  a = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
  b = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
})
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await reset()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await reset()
})

describe("admin.revenue — quyền và kiểm tra khoảng", () => {
  it("giáo viên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.revenue({ from: { year: 2025, month: 1 }, to: { year: 2025, month: 3 } })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
  it("khoảng ngược / quá 36 tháng → BAD_REQUEST", async () => {
    const c = await getAuthedCaller("admin_test")
    await expect(c.admin.revenue({ from: { year: 2025, month: 5 }, to: { year: 2025, month: 3 } })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(c.admin.revenue({ from: { year: 2025, month: 1 }, to: { year: 2028, month: 1 } })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("admin.revenue — số liệu (spec K C1–C5)", () => {
  it("chỉ cộng đơn user đã duyệt có tiền, theo tháng giờ VN; phân loại xét cả đơn trước khoảng", async () => {
    await seed([
      // 23:59 ngày 31/12/2024 giờ VN: ngoài khoảng, làm các đơn 2025 của A thành gia hạn.
      { userId: a, plan: "plus", period: "month", amount: 49000, status: "approved", decidedAt: "2024-12-31T16:59:00Z" },
      { userId: a, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: "2025-01-31T16:30:00Z" },
      { userId: a, plan: "pro", period: "year", amount: 990000, status: "approved", creditDays: 100, decidedAt: "2025-02-10T03:00:00Z" },
      { userId: a, plan: "pro", period: "2year", amount: 1980000, status: "approved", decidedAt: "2025-03-01T00:00:00Z" },
      // B: đơn admin tặng 0đ trước, không làm đơn có tiền đầu tiên thành gia hạn.
      { userId: b, plan: "pro", period: null, amount: 0, status: "approved", source: "admin", decidedAt: "2025-01-05T03:00:00Z" },
      // 00:10 ngày 1/2 giờ VN → tháng 2.
      { userId: b, plan: "plus", period: "month", amount: 49000, status: "approved", decidedAt: "2025-01-31T17:10:00Z" },
      { userId: b, plan: "pro", period: "month", amount: 99000, status: "rejected", decidedAt: "2025-02-11T03:00:00Z" },
      { userId: b, plan: "pro", period: "year", amount: 990000, status: "cancelled", decidedAt: null },
      { userId: b, plan: "pro", period: "year", amount: 990000, status: "pending", decidedAt: null },
    ])
    const r = await (await getAuthedCaller("admin_test")).admin.revenue({ from: { year: 2025, month: 1 }, to: { year: 2025, month: 3 } })

    expect(r.months.map((m) => [m.month, m.total.amount, m.total.count])).toEqual([
      [1, 490000, 1],
      [2, 1039000, 2],
      [3, 1980000, 1],
    ])
    expect(r.months[1].byKind).toEqual({ new: { amount: 49000, count: 1 }, renew: { amount: 0, count: 0 }, upgrade: { amount: 990000, count: 1 } })
    expect(r.summary.total).toEqual({ amount: 3509000, count: 4 })
    expect(r.summary.byKind).toEqual({ new: { amount: 49000, count: 1 }, renew: { amount: 2470000, count: 2 }, upgrade: { amount: 990000, count: 1 } })
    expect(r.summary.byPlan).toEqual({ plus: { amount: 539000, count: 2 }, pro: { amount: 2970000, count: 2 } })
    expect(r.summary.byPeriod).toEqual({ month: { amount: 49000, count: 1 }, year: { amount: 1480000, count: 2 }, "2year": { amount: 1980000, count: 1 } })
  })

  it("xóa mềm tài khoản có đơn đã duyệt → doanh thu KHÔNG đổi (spec K K16)", async () => {
    await seed([{ userId: a, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: "2025-05-10T03:00:00Z" }])
    const admin = await getAuthedCaller("admin_test")
    const range = { from: { year: 2025, month: 5 }, to: { year: 2025, month: 5 } }
    const before = await admin.admin.revenue(range)
    expect(before.summary.total).toEqual({ amount: 490000, count: 1 })
    await db.user.update({ where: { id: a }, data: { isDeleted: true } })
    try {
      expect(await admin.admin.revenue(range)).toEqual(before)
    } finally {
      await db.user.update({ where: { id: a }, data: { isDeleted: false } })
    }
  })

  it("khoảng không có đơn → mọi tháng 0đ, vẫn đủ dòng", async () => {
    const r = await (await getAuthedCaller("admin_test")).admin.revenue({ from: { year: 2025, month: 11 }, to: { year: 2026, month: 2 } })
    expect(r.months.map((m) => [m.year, m.month, m.total.amount])).toEqual([
      [2025, 11, 0],
      [2025, 12, 0],
      [2026, 1, 0],
      [2026, 2, 0],
    ])
    expect(r.summary.total).toEqual({ amount: 0, count: 0 })
  })
})
