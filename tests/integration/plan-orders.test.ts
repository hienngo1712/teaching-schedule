import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { addDays, vnStartOfDay } from "@/lib/plans"

const BANK_ENV = { PLAN_BANK_BIN: "970436", PLAN_BANK_ACCOUNT_NUMBER: "0123456789", PLAN_BANK_ACCOUNT_NAME: "CHU APP TEST" }
const FAR = new Date("2099-12-31T17:00:00.000Z")
let userId = 0

function setBankEnv(on: boolean) {
  for (const [k, v] of Object.entries(BANK_ENV)) {
    if (on) process.env[k] = v
    else delete process.env[k]
  }
}

async function reset() {
  // tests/setup.ts không xóa bảng giá: dòng giá test thêm phải xóa để file khác thấy 49.000/99.000.
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
  await db.planOrder.deleteMany({ where: { user: { username: { in: ["teacher_std", "teacher", "admin_test"] } } } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: null } })
}

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
})
beforeEach(async () => {
  setBankEnv(true)
  delete process.env.ADMIN_USERNAMES
  await reset()
})
afterAll(async () => {
  setBankEnv(false)
  await reset()
})

describe("plan.me", () => {
  it("Standard: gói, nguồn, giới hạn, chưa có đơn, paymentReady, không phải admin", async () => {
    const me = await (await getAuthedCaller("teacher_std")).plan.me()
    expect(me).toMatchObject({
      plan: "standard",
      source: "free",
      expiresAt: null,
      paidPlan: "standard",
      studentLimit: 10,
      plusCreditOrder: null,
      pendingOrder: null,
      orders: [],
      paymentReady: true,
      isAdmin: false,
    })
    expect(typeof me.activeStudents).toBe("number")
  })

  it("isAdmin theo ADMIN_USERNAMES (trim, khớp chính xác)", async () => {
    process.env.ADMIN_USERNAMES = " admin_test , khac "
    expect((await (await getAuthedCaller("admin_test")).plan.me()).isAdmin).toBe(true)
    expect((await (await getAuthedCaller("teacher_std")).plan.me()).isAdmin).toBe(false)
    process.env.ADMIN_USERNAMES = "admin_test2"
    expect((await (await getAuthedCaller("admin_test")).plan.me()).isAdmin).toBe(false)
  })

  it("Plus: plusCreditOrder = đơn Plus đã duyệt mới nhất", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: FAR } })
    await db.planOrder.create({ data: { userId, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: new Date() } })
    const me = await (await getAuthedCaller("teacher_std")).plan.me()
    expect(me.plusCreditOrder).toEqual({ amount: 490000, period: "year", bonusMonths: 0 })
  })
})

describe("plan.createOrder / cancelOrder", () => {
  it("tạo đơn → pending, tiền theo bảng giá, mã 6 ký tự hợp lệ; plan.me có QR nội dung SM <mã>", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id, code, bonusMonths, amount } = await c.plan.createOrder({ plan: "plus", period: "year" })
    expect(amount).toBe(490000) // spec U U27: popup cần số tiền khi tải lại đơn lỗi
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    expect(bonusMonths).toBe(0)
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({
      userId,
      plan: "plus",
      period: "year",
      amount: 490000,
      status: "pending",
      source: "user",
      code,
      bonusMonths: 0,
    })
    const me = await c.plan.me()
    expect(me.pendingOrder).toMatchObject({ id, code, amount: 490000, transferContent: `SM ${code}` })
    expect(me.pendingOrder?.qr).toMatchObject({ bankShortName: "Vietcombank", accountNumber: "0123456789", accountName: "CHU APP TEST" })
    expect(me.pendingOrder?.qr?.payload).toContain(`SM ${code}`)
    expect(me.orders.map((o) => o.id)).toContain(id)
  })

  it("kỳ 2 năm mua mới: 980.000đ, tặng 2 tháng", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id, bonusMonths } = await c.plan.createOrder({ plan: "plus", period: "2year" })
    expect(bonusMonths).toBe(2)
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ amount: 980000, period: "2year", bonusMonths: 2 })
  })

  it("gia hạn sớm còn 45 ngày: 2 năm tặng 4 tháng, chốt vào đơn lúc tạo", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(vnStartOfDay(new Date()), 45) } })
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "pro", period: "2year" })
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ amount: 1980000, bonusMonths: 4 })
  })

  it("client gửi thêm amount → bị bỏ qua (zod strip), tiền vẫn theo bảng giá", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "pro", period: "month", amount: 1 } as never)
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).amount).toBe(99000)
  })

  it("tạo đơn thứ 2 → đơn 1 cancelled, chỉ còn 1 pending", async () => {
    const c = await getAuthedCaller("teacher_std")
    const first = await c.plan.createOrder({ plan: "plus", period: "month" })
    const second = await c.plan.createOrder({ plan: "pro", period: "year" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("cancelled")
    expect(await db.planOrder.count({ where: { userId, status: "pending" } })).toBe(1)
    expect((await c.plan.me()).pendingOrder?.id).toBe(second.id)
  })

  it("2 lần tạo đơn cùng lúc → đúng 1 đơn pending", async () => {
    const c = await getAuthedCaller("teacher_std")
    await Promise.all([c.plan.createOrder({ plan: "plus", period: "month" }), c.plan.createOrder({ plan: "pro", period: "month" })])
    expect(await db.planOrder.count({ where: { userId, status: "pending" } })).toBe(1)
  })

  it("Pro trả phí còn hạn đặt Plus → BAD_REQUEST; đặt Pro (gia hạn) vẫn được", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: FAR } })
    const c = await getAuthedCaller("teacher_std")
    await expect(c.plan.createOrder({ plan: "plus", period: "year" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(c.plan.createOrder({ plan: "pro", period: "year" })).resolves.toMatchObject({ code: expect.any(String) })
  })

  it("thiếu env ngân hàng → PRECONDITION_FAILED, paymentReady=false", async () => {
    setBankEnv(false)
    const c = await getAuthedCaller("teacher_std")
    await expect(c.plan.createOrder({ plan: "plus", period: "month" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Chưa mở thanh toán",
    })
    expect((await c.plan.me()).paymentReady).toBe(false)
  })

  it("hủy đơn của mình → cancelled; hủy đơn người khác hoặc đơn đã hủy → NOT_FOUND", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "month" })
    await expect((await getAuthedCaller("teacher")).plan.cancelOrder({ id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(c.plan.cancelOrder({ id })).resolves.toEqual({ success: true })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).status).toBe("cancelled")
    await expect(c.plan.cancelOrder({ id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("giá từ DB (spec L)", () => {
  const addPrice = (plan: "plus" | "pro", monthPrice: number, previousMonthPrice: number) =>
    db.planPriceChange.create({ data: { plan, monthPrice, previousMonthPrice, changedBy: "price_test" } })

  it("plan.me.prices theo bảng giá DB, đổi giá thấy ngay", async () => {
    const c = await getAuthedCaller("teacher_std")
    expect((await c.plan.me()).prices).toEqual({
      plus: { month: 49000, year: 490000, "2year": 980000 },
      pro: { month: 99000, year: 990000, "2year": 1980000 },
    })
    await addPrice("plus", 59000, 49000)
    expect((await c.plan.me()).prices.plus).toEqual({ month: 59000, year: 590000, "2year": 1180000 })
  })

  it("tạo đơn sau khi đổi giá: không gửi expectedAmount → giá mới; expectedAmount khớp → tạo được", async () => {
    await addPrice("plus", 59000, 49000)
    const c = await getAuthedCaller("teacher_std")
    const a = await c.plan.createOrder({ plan: "plus", period: "year" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: a.id } })).amount).toBe(590000)
    const b = await c.plan.createOrder({ plan: "plus", period: "month", expectedAmount: 59000 })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: b.id } })).amount).toBe(59000)
  })

  it("expectedAmount lệch giá DB → CONFLICT, không tạo đơn, đơn chờ cũ vẫn pending", async () => {
    const c = await getAuthedCaller("teacher_std")
    const old = await c.plan.createOrder({ plan: "pro", period: "month", expectedAmount: 99000 })
    await addPrice("plus", 59000, 49000)
    await expect(c.plan.createOrder({ plan: "plus", period: "year", expectedAmount: 490000 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới",
    })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("pending")
    expect(await db.planOrder.count({ where: { userId } })).toBe(1)
  })

  it("đổi giá khi có đơn chờ: amount và QR giữ nguyên, duyệt vẫn 490.000", async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year", expectedAmount: 490000 })
    await addPrice("plus", 59000, 49000)
    const me = await c.plan.me()
    expect(me.pendingOrder).toMatchObject({ id, amount: 490000 })
    // Tag 54 của VietQR = số tiền, độ dài 06.
    expect(me.pendingOrder?.qr?.payload).toContain("5406490000")
    await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "approved", amount: 490000 })
  })

  it("quy đổi Plus→Pro: mẫu số là amount đơn Pro (990.000) dù giá Pro đổi 129.000 trước lúc duyệt", async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    const today = vnStartOfDay(new Date())
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: addDays(today, 304) } })
    await db.planOrder.create({ data: { userId, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: new Date() } })
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "pro", period: "year" })
    await addPrice("pro", 129000, 99000)
    const res = await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    // floor(408.110 × 365 / 990.000) = 150; nếu đọc giá mới 1.290.000 sẽ ra 115.
    expect(res.creditDays).toBe(150)
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).amount).toBe(990000)
  })

  it("race: tạo đơn (expectedAmount giá cũ) song song admin đổi giá → đơn luôn đúng giá đã thấy, nếu không thì CONFLICT và không có đơn", async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    const teacher = await getAuthedCaller("teacher_std")
    const admin = await getAuthedCaller("admin_test")
    for (let i = 0; i < 5; i++) {
      await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
      await db.planOrder.deleteMany({ where: { userId } })
      const [order, update] = await Promise.allSettled([
        teacher.plan.createOrder({ plan: "plus", period: "year", expectedAmount: 490000 }),
        admin.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected: { plus: 49000, pro: 99000 } }),
      ])
      expect(update.status).toBe("fulfilled")
      if (order.status === "fulfilled") {
        expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.value.id } })).amount).toBe(490000)
      } else {
        expect(order.reason).toMatchObject({ code: "CONFLICT" })
        expect(await db.planOrder.count({ where: { userId } })).toBe(0)
      }
    }
  })
})

const DAY = 24 * 60 * 60 * 1000
async function backdate(id: number, ms: number) {
  await db.planOrder.update({ where: { id }, data: { createdAt: new Date(Date.now() - ms) } })
}

describe("đơn chờ hết hạn sau 7 ngày (spec P7)", () => {
  it("quá 7 ngày → plan.me không còn pendingOrder; đơn thành expired, decidedAt = createdAt + 7 ngày, decidedBy null", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(id, 7 * DAY + 60_000)
    const me = await c.plan.me()
    expect(me.pendingOrder).toBeNull()
    expect(me.orders.find((o) => o.id === id)?.status).toBe("expired")
    const row = await db.planOrder.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe("expired")
    expect(row.decidedAt?.getTime()).toBe(row.createdAt.getTime() + 7 * DAY)
    expect(row.decidedBy).toBeNull()
  })

  it("6 ngày 23 giờ → vẫn pending, pendingOrder.expiresAt = createdAt + 7 ngày", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(id, 7 * DAY - 60 * 60 * 1000)
    const me = await c.plan.me()
    const row = await db.planOrder.findUniqueOrThrow({ where: { id } })
    expect(me.pendingOrder?.id).toBe(id)
    expect(new Date(me.pendingOrder!.expiresAt).getTime()).toBe(row.createdAt.getTime() + 7 * DAY)
  })

  it("tạo đơn mới khi đơn cũ đã quá hạn → đơn cũ expired (không phải cancelled)", async () => {
    const c = await getAuthedCaller("teacher_std")
    const first = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(first.id, 8 * DAY)
    await c.plan.createOrder({ plan: "plus", period: "month" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("expired")
  })

  it("hủy đơn đã quá hạn → NOT_FOUND, trạng thái expired", async () => {
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year" })
    await backdate(id, 8 * DAY)
    await expect(c.plan.cancelOrder({ id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).status).toBe("expired")
  })

  it("plan.me của user này không expire đơn quá hạn của user khác", async () => {
    const other = await getAuthedCaller("teacher")
    const { id } = await other.plan.createOrder({ plan: "pro", period: "year" })
    await backdate(id, 8 * DAY)
    await (await getAuthedCaller("teacher_std")).plan.me()
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).status).toBe("pending")
  })
})
