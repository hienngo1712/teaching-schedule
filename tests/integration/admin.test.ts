import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { addDays, addMonthsVn, expiryFromLastDay, vnStartOfDay } from "@/lib/plans"

const BANK_ENV = { PLAN_BANK_BIN: "970436", PLAN_BANK_ACCOUNT_NUMBER: "0123456789", PLAN_BANK_ACCOUNT_NAME: "CHU APP TEST" }
const FAR = new Date("2099-12-31T17:00:00.000Z")
let userId = 0

async function reset() {
  await db.planOrder.deleteMany({ where: { user: { username: { in: ["teacher_std", "admin_test"] } } } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: null } })
}

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
})
beforeEach(async () => {
  Object.assign(process.env, BANK_ENV, { ADMIN_USERNAMES: "admin_test" })
  await reset()
})
afterAll(async () => {
  for (const k of [...Object.keys(BANK_ENV), "ADMIN_USERNAMES"]) delete process.env[k]
  await reset()
})

describe("admin.* — quyền", () => {
  it("user thường → FORBIDDEN; admin nhưng env không có tên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.approveOrder({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.rejectOrder({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.setPlan({ userId, plan: "pro", lastDay: "2099-01-01", note: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    delete process.env.ADMIN_USERNAMES
    await expect((await getAuthedCaller("admin_test")).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

describe("admin.overview / approveOrder / rejectOrder", () => {
  it("overview: có teacher_std (gói hiệu lực, số HS đang học) và đơn chờ kèm preview hạn", async () => {
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "plus", period: "month" })
    const ov = await (await getAuthedCaller("admin_test")).admin.overview()
    const row = ov.users.find((u) => u.username === "teacher_std")
    expect(row).toMatchObject({ plan: "standard", source: "free", expiresAt: null, activeStudents: expect.any(Number) })
    const pending = ov.pendingOrders.find((o) => o.id === id)
    expect(pending).toMatchObject({ username: "teacher_std", plan: "plus", period: "month", amount: 49000 })
    expect(pending?.preview?.grantedUntil).toEqual(addMonthsVn(vnStartOfDay(new Date()), 1))
  })

  it("duyệt đơn Plus tháng → user Plus, hạn = đầu ngày VN + 1 tháng, decidedBy; duyệt lần 2 → CONFLICT, hạn không đổi", async () => {
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "plus", period: "month" })
    const admin = await getAuthedCaller("admin_test")
    const expected = addMonthsVn(vnStartOfDay(new Date()), 1)
    expect(await admin.admin.approveOrder({ id })).toEqual({ grantedUntil: expected, creditDays: 0 })
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(u.plan).toBe("plus")
    expect(u.planExpiresAt).toEqual(expected)
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "approved",
      decidedBy: "admin_test",
      grantedUntil: expected,
      creditDays: 0,
    })
    await expect(admin.admin.approveOrder({ id })).rejects.toMatchObject({ code: "CONFLICT" })
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).planExpiresAt).toEqual(expected)
  })

  it("duyệt 2 đơn Plus tháng cùng lúc → hạn cộng dồn 2 tháng, không ghi đè nhau", async () => {
    const [a, b] = await Promise.all(
      [1, 2].map(() => db.planOrder.create({ data: { userId, plan: "plus", period: "month", amount: 49000, status: "pending" } }))
    )
    const admin = await getAuthedCaller("admin_test")
    await Promise.all([admin.admin.approveOrder({ id: a.id }), admin.admin.approveOrder({ id: b.id })])
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).planExpiresAt).toEqual(addMonthsVn(addMonthsVn(vnStartOfDay(new Date()), 1), 1))
  })

  it("gia hạn cùng gói còn 10 ngày: cộng dồn từ hạn cũ, tặng 1 tháng khi mua năm (chốt lúc tạo đơn)", async () => {
    const oldExpiry = addDays(vnStartOfDay(new Date()), 10)
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: oldExpiry } })
    const { id, bonusMonths } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "plus", period: "year" })
    expect(bonusMonths).toBe(1)
    const res = await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    expect(res.grantedUntil).toEqual(addMonthsVn(oldExpiry, 13))
  })

  it("Plus năm còn 304 ngày → mua Pro năm: quy đổi +150 ngày, lưu credit_days", async () => {
    const today = vnStartOfDay(new Date())
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: addDays(today, 304) } })
    await db.planOrder.create({ data: { userId, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: new Date() } })
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "pro", period: "year" })
    const res = await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    expect(res).toEqual({ grantedUntil: addDays(addMonthsVn(today, 12), 150), creditDays: 150 })
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("pro")
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).creditDays).toBe(150)
  })

  it("Plus năm còn 45 ngày → mua Pro năm: tặng 2 tháng + quy đổi 22 ngày", async () => {
    const today = vnStartOfDay(new Date())
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: addDays(today, 45) } })
    await db.planOrder.create({ data: { userId, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: new Date() } })
    const { id, bonusMonths } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "pro", period: "year" })
    expect(bonusMonths).toBe(2)
    const res = await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    expect(res).toEqual({ grantedUntil: addDays(addMonthsVn(today, 14), 22), creditDays: 22 })
  })

  it("đơn Plus duyệt khi user đã có Pro trả phí → BAD_REQUEST, đơn vẫn pending, gói không đổi; overview preview=null", async () => {
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "plus", period: "month" })
    await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: FAR } })
    const admin = await getAuthedCaller("admin_test")
    expect((await admin.admin.overview()).pendingOrders.find((o) => o.id === id)?.preview).toBeNull()
    await expect(admin.admin.approveOrder({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).status).toBe("pending")
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("pro")
  })

  it("từ chối → rejected + note + decidedBy; từ chối lần 2 → CONFLICT", async () => {
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "plus", period: "month" })
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.rejectOrder({ id, note: "Chưa nhận được tiền" })).resolves.toEqual({ success: true })
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "rejected",
      note: "Chưa nhận được tiền",
      decidedBy: "admin_test",
    })
    await expect(admin.admin.rejectOrder({ id })).rejects.toMatchObject({ code: "CONFLICT" })
  })
})

describe("admin.setPlan", () => {
  it("đặt Pro tới hết 31/12/2026 → hạn 00:00 VN 01/01/2027, 1 dòng log admin; không đụng trialEndsAt", async () => {
    const trial = addDays(vnStartOfDay(new Date()), 20)
    await db.user.update({ where: { id: userId }, data: { trialEndsAt: trial } })
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.setPlan({ userId, plan: "pro", lastDay: "2026-12-31", note: "Tặng khách quen" })).resolves.toEqual({ success: true })
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(u.plan).toBe("pro")
    expect(u.planExpiresAt).toEqual(expiryFromLastDay("2026-12-31"))
    expect(u.trialEndsAt).toEqual(trial)
    const logs = await db.planOrder.findMany({ where: { userId } })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ source: "admin", status: "approved", amount: 0, period: null, code: null, note: "Tặng khách quen", decidedBy: "admin_test" })
  })

  it("đặt Standard → planExpiresAt null", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: FAR } })
    await (await getAuthedCaller("admin_test")).admin.setPlan({ userId, plan: "standard", note: "Sửa sai" })
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect([u.plan, u.planExpiresAt]).toEqual(["standard", null])
  })

  it("thiếu note / note rỗng / gói trả phí thiếu lastDay → BAD_REQUEST; user không tồn tại → NOT_FOUND", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.setPlan({ userId, plan: "pro", lastDay: "2026-12-31" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(admin.admin.setPlan({ userId, plan: "pro", lastDay: "2026-12-31", note: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(admin.admin.setPlan({ userId, plan: "pro", note: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(admin.admin.setPlan({ userId: 99999999, plan: "pro", lastDay: "2026-12-31", note: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await db.planOrder.count({ where: { userId } })).toBe(0)
  })
})
