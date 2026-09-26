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
    const { id, code, bonusMonths } = await c.plan.createOrder({ plan: "plus", period: "year" })
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
