import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { signWebhookData } from "@/server/payos"
import { handlePayosWebhook } from "@/server/services/payos-order.service"
import { approveOrder, rejectOrder, getAdminOverview, getPendingCount } from "@/server/services/plan-admin.service"
import { addDays } from "@/lib/plans"

const ENV = {
  PLAN_BANK_BIN: "970436", PLAN_BANK_ACCOUNT_NUMBER: "0123456789", PLAN_BANK_ACCOUNT_NAME: "CHU APP TEST",
  PAYOS_CLIENT_ID: "test-client", PAYOS_API_KEY: "test-api-key", PAYOS_CHECKSUM_KEY: "test-checksum-key",
}
let userId = 0

async function makeOrder(over: Partial<{ status: string; amount: number; createdAt: Date; plan: string; payosLinkId: string }> = {}) {
  return db.planOrder.create({
    data: {
      userId, plan: over.plan ?? "pro", period: "month", amount: over.amount ?? 99000, code: `T${Math.floor(Math.random() * 1e5)}`,
      status: over.status ?? "pending", method: "payos", payosLinkId: over.payosLinkId ?? "pl-x", createdAt: over.createdAt ?? new Date(),
    },
  })
}

function payload(o: { id: number; payosLinkId: string | null }, amount: number, reference = `REF${o.id}-${amount}`) {
  const data = {
    orderCode: o.id, amount, description: "SM ABC123", accountNumber: "0123456789", reference,
    transactionDateTime: "2026-10-09 20:15:00", currency: "VND", paymentLinkId: o.payosLinkId,
    code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null,
    counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "",
  }
  return { code: "00", desc: "success", success: true, data, signature: signWebhookData(ENV.PAYOS_CHECKSUM_KEY, data) }
}

beforeAll(async () => { userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id })
beforeEach(async () => {
  Object.assign(process.env, ENV)
  await db.planOrder.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: null } })
})
afterAll(async () => {
  for (const k of Object.keys(ENV)) delete process.env[k]
  await db.planOrder.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
})

describe("handlePayosWebhook", () => {
  it("pending đủ tiền → gói bật, decidedBy payos, ghi paidAmount/paidAt/payosRef", async () => {
    const o = await makeOrder()
    expect(await handlePayosWebhook(db, payload(o, 99000))).toMatchObject({ status: 200 })
    const after = await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })
    expect(after).toMatchObject({ status: "approved", decidedBy: "payos", paidAmount: 99000, payosRef: `REF${o.id}-99000` })
    expect(after.paidAt?.toISOString()).toBe("2026-10-09T13:15:00.000Z")
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("pro")
  })
  it("dư tiền vẫn bật", async () => {
    const o = await makeOrder()
    await handlePayosWebhook(db, payload(o, 120000))
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("approved")
  })
  it("gửi lặp cùng reference: không cộng ngày lần 2", async () => {
    const o = await makeOrder()
    await handlePayosWebhook(db, payload(o, 99000))
    const first = (await db.user.findUniqueOrThrow({ where: { id: userId } })).planExpiresAt
    expect(await handlePayosWebhook(db, payload(o, 99000))).toMatchObject({ status: 200 })
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).planExpiresAt).toEqual(first)
  })
  it("2 webhook song song (cùng reference) chỉ kích hoạt 1 lần", async () => {
    const o = await makeOrder()
    const res = await Promise.all([handlePayosWebhook(db, payload(o, 99000)), handlePayosWebhook(db, payload(o, 99000))])
    expect(res.every((r) => r.status === 200)).toBe(true)
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(u.planExpiresAt!.getTime() - Date.now()).toBeLessThan(40 * 86400_000)
  })
  it("thiếu tiền → vẫn pending, có paidAmount (cần xử lý)", async () => {
    const o = await makeOrder()
    await handlePayosWebhook(db, payload(o, 50000))
    expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "pending", paidAmount: 50000 })
  })
  it.each(["expired", "cancelled", "rejected"])("đơn %s nhận đủ tiền → không bật, ghi paidAmount", async (status) => {
    const o = await makeOrder({ status })
    await handlePayosWebhook(db, payload(o, 99000))
    expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status, paidAmount: 99000 })
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("standard")
  })
  it("đơn pending quá 7 ngày (chưa ai chốt expired) nhận đủ tiền → expired, không bật", async () => {
    const o = await makeOrder({ createdAt: addDays(new Date(), -8) })
    await handlePayosWebhook(db, payload(o, 99000))
    expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "expired", paidAmount: 99000 })
  })
  it("Plus khi đang có Pro trả phí (không duyệt được) → 200, vẫn pending có tiền", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 60) } })
    const o = await makeOrder({ plan: "plus", amount: 49000 })
    expect(await handlePayosWebhook(db, payload(o, 49000))).toMatchObject({ status: 200 })
    expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "pending", paidAmount: 49000 })
  })
  it("paymentLinkId không khớp (giao dịch thử payOS trùng id) → bỏ qua", async () => {
    const o = await makeOrder({ payosLinkId: "pl-that" })
    expect(await handlePayosWebhook(db, payload({ id: o.id, payosLinkId: "pl-thu" }, 3000))).toMatchObject({ status: 200 })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).paidAmount).toBeNull()
  })
  it("orderCode lạ → 200; chữ ký sai → 401; thiếu data → 400; chưa cấu hình → 503", async () => {
    const o = await makeOrder()
    expect((await handlePayosWebhook(db, payload({ id: 999999, payosLinkId: "x" }, 1))).status).toBe(200)
    const bad = payload(o, 99000); bad.signature = "0".repeat(64)
    expect((await handlePayosWebhook(db, bad)).status).toBe(401)
    expect((await handlePayosWebhook(db, { signature: "x" })).status).toBe(400)
    delete process.env.PAYOS_CHECKSUM_KEY
    expect((await handlePayosWebhook(db, payload(o, 99000))).status).toBe(503)
  })
})

describe("admin xử lý đơn có tiền payOS", () => {
  it("admin duyệt đơn expired có tiền → gói bật; từ chối đơn có tiền → rời nhóm cần xử lý", async () => {
    const a = await makeOrder({ status: "expired", createdAt: addDays(new Date(), -8) })
    await handlePayosWebhook(db, payload(a, 99000))
    let ov = await getAdminOverview(db)
    expect(ov.attentionOrders.map((o) => o.id)).toContain(a.id)
    expect((await getPendingCount(db)).count).toBeGreaterThanOrEqual(1)
    await approveOrder(db, "admin_test", a.id)
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("pro")

    const b = await makeOrder({ status: "cancelled" })
    await handlePayosWebhook(db, payload(b, 99000))
    await rejectOrder(db, "admin_test", b.id)
    const rb = await db.planOrder.findUniqueOrThrow({ where: { id: b.id } })
    expect(rb.status).toBe("rejected")
    expect(rb.paidReviewedAt).not.toBeNull()
    ov = await getAdminOverview(db)
    expect(ov.attentionOrders.map((o) => o.id)).not.toContain(b.id)
  })
})
