import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { createOrder, cancelOrder, getMyPlan } from "@/server/services/plan.service"

const ENV = {
  PLAN_BANK_BIN: "970436", PLAN_BANK_ACCOUNT_NUMBER: "0123456789", PLAN_BANK_ACCOUNT_NAME: "CHU APP TEST",
  PAYOS_CLIENT_ID: "test-client", PAYOS_API_KEY: "test-api-key", PAYOS_CHECKSUM_KEY: "test-checksum-key",
}
const ORIGIN = "http://localhost:3000"
const okLink = () => new Response(JSON.stringify({ code: "00", data: { paymentLinkId: "pl-1", qrCode: "000201PAYOSQR", checkoutUrl: "https://pay.payos.vn/web/pl-1" } }), { status: 200 })
let userId = 0

beforeAll(async () => { userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id })
beforeEach(async () => {
  vi.restoreAllMocks()
  Object.assign(process.env, ENV)
  await db.planOrder.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: null } })
})
afterAll(async () => {
  vi.restoreAllMocks()
  for (const k of Object.keys(ENV)) delete process.env[k]
  await db.planOrder.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
})

describe("createOrder với payOS", () => {
  it("payos thành công: lưu link, me trả payos + payosReady", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(okLink())
    const r = await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
    expect(r).toMatchObject({ method: "payos", payosFailed: false })
    const body = JSON.parse(f.mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ orderCode: r.id, amount: r.amount, description: `SM ${r.code}`, returnUrl: `${ORIGIN}/plan`, cancelUrl: `${ORIGIN}/plan` })
    const me = await getMyPlan(db, userId, "teacher_std")
    expect(me.payosReady).toBe(true)
    expect(me.pendingOrder).toMatchObject({ method: "payos", payos: { qr: "000201PAYOSQR", checkoutUrl: "https://pay.payos.vn/web/pl-1" } })
  })
  it("payOS lỗi/timeout → đơn thành vietqr, payosFailed", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timeout", "TimeoutError"))
    const r = await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
    expect(r).toMatchObject({ method: "vietqr", payosFailed: true })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: r.id } })).method).toBe("vietqr")
  })
  it("không gửi method (tab JS cũ) hoặc chưa cấu hình payOS → vietqr, không gọi fetch", async () => {
    const f = vi.spyOn(globalThis, "fetch")
    expect((await createOrder(db, userId, { plan: "pro", period: "month" }, ORIGIN)).method).toBe("vietqr")
    delete process.env.PAYOS_API_KEY
    expect((await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)).method).toBe("vietqr")
    expect(f).not.toHaveBeenCalled()
    expect((await getMyPlan(db, userId, "teacher_std")).payosReady).toBe(false)
  })
  it("huỷ đơn payOS → gọi API huỷ link; API lỗi vẫn huỷ được", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(okLink())
    const r = await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
    f.mockResolvedValueOnce(new Response("err", { status: 500 }))
    await expect(cancelOrder(db, userId, r.id)).resolves.toEqual({ success: true })
    expect(f.mock.calls[1][0]).toBe("https://api-merchant.payos.vn/v2/payment-requests/pl-1/cancel")
  })
  it("đơn mới thay đơn payOS cũ → huỷ link cũ", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(okLink())
    await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
    await createOrder(db, userId, { plan: "pro", period: "year", method: "vietqr" }, ORIGIN)
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/pl-1/cancel"))).toBe(true)
  })
})
