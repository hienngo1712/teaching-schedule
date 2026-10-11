// Spec AO §3.2: webhook payOS học phí rẽ nhánh theo orderCode → ghi "Đã nhận" cho nơi dạy. Không gọi payOS thật.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { addDays } from "@/lib/plans"
import { signWebhookData } from "@/server/payos"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"
import { PLACE_ORDER_OFFSET } from "@/server/services/place-paylink.service"

const HOOK = "H".repeat(43)
let userId = 0
let placeId = 0
let original: { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }

async function clean() {
  await db.placePayLink.deleteMany()
  await db.teacherPayos.deleteMany()
  await db.placePayment.deleteMany()
  await db.teachingPlace.deleteMany()
}

async function makeLink(over: Partial<{ amount: number; status: string }> = {}) {
  return db.placePayLink.create({
    data: { userId, placeId, year: 2026, month: 10, amount: over.amount ?? 455000, status: over.status ?? "active", payosLinkId: `pl-${Math.random()}`, qrCode: "q", checkoutUrl: "c" },
  })
}
function payload(
  l: { id: number; payosLinkId: string }, amount: number,
  o: Partial<{ reference: string; key: string; orderCode: number; paymentLinkId: string }> = {}
) {
  const data = {
    orderCode: o.orderCode ?? PLACE_ORDER_OFFSET + l.id, amount, description: `ND ${l.id}`, accountNumber: "0001",
    reference: o.reference ?? `R${l.id}-${amount}`, transactionDateTime: "2026-10-09 23:32:00", currency: "VND",
    paymentLinkId: o.paymentLinkId ?? l.payosLinkId, code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "",
    counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "",
  }
  return { code: "00", desc: "success", success: true, data, signature: signWebhookData(o.key ?? "t-checksum", data) }
}
const payments = () => db.placePayment.findMany({ where: { placeId }, orderBy: { id: "asc" } })

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  await clean()
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 30), trialEndsAt: null } })
  placeId = (await db.teachingPlace.create({ data: { userId, name: "TT Ánh Dương", kind: "center", color: "#0891B2" } })).id
  await db.teacherPayos.create({ data: { userId, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: HOOK } })
})
afterAll(async () => {
  await clean()
  await db.user.update({ where: { id: userId }, data: original })
})

describe("AO: webhook payOS cho phiếu nơi dạy", () => {
  it("hợp lệ: PlacePayment source=payos, ngày nhận theo giờ VN, link paid khi đủ", async () => {
    const l = await makeLink()
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { reference: "FT1" }))).toEqual({ status: 200, note: "đã ghi" })
    const [p] = await payments()
    expect(p).toMatchObject({ year: 2026, month: 10, amount: 455000, source: "payos", note: "payOS · FT1", isDeleted: false })
    expect(p.receivedAt.toISOString().slice(0, 10)).toBe("2026-10-09")
    const lp = await db.placePayLinkPayment.findFirstOrThrow({ where: { linkId: l.id } })
    expect(lp).toMatchObject({ reference: "FT1", amount: 455000, placePaymentId: p.id })
    expect((await db.placePayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("paid")
  })

  it("nhận 2 đợt A, B rồi A gửi lại: tổng đúng, link paid khi đủ", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000, { reference: "A" }))
    expect((await db.placePayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("active")
    await handleTuitionWebhook(db, HOOK, payload(l, 255000, { reference: "B" }))
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 200000, { reference: "A" }))).toEqual({ status: 200, note: "gửi lặp" })
    const ps = await payments()
    expect(ps.map((p) => p.amount)).toEqual([200000, 255000])
    expect((await db.placePayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("paid")
  })

  it("[RF 2] 2 webhook cùng reference đến song song: chỉ 1 PlacePayment", async () => {
    const l = await makeLink()
    const body = payload(l, 455000, { reference: "SAME" })
    const rs = await Promise.all([handleTuitionWebhook(db, HOOK, body), handleTuitionWebhook(db, HOOK, body), handleTuitionWebhook(db, HOOK, body)])
    expect(rs.every((r) => r.status === 200)).toBe(true)
    expect(await payments()).toHaveLength(1)
    expect(await db.placePayLinkPayment.count({ where: { linkId: l.id } })).toBe(1)
  })

  it("paymentLinkId lệch: bỏ qua", async () => {
    const l = await makeLink()
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { paymentLinkId: "pl-khac" }))).toEqual({ status: 200, note: "không khớp" })
    expect(await payments()).toHaveLength(0)
  })

  it("chữ ký sai: 401, không ghi", async () => {
    const l = await makeLink()
    expect((await handleTuitionWebhook(db, HOOK, payload(l, 455000, { key: "sai" }))).status).toBe(401)
    expect(await payments()).toHaveLength(0)
  })

  it("[RF 1] orderCode nhỏ (giao dịch thử 123 hay id link nơi dạy không cộng offset) đi luồng HS: không ghi nơi dạy", async () => {
    const l = await makeLink()
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { orderCode: 123 }))).toEqual({ status: 200, note: "không khớp" })
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { orderCode: l.id }))).toEqual({ status: 200, note: "không khớp" })
    expect(await payments()).toHaveLength(0)
  })

  it("[RF 3] GV hết Pro sau khi phát QR: tiền vẫn được ghi", async () => {
    const l = await makeLink()
    await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000))).toEqual({ status: 200, note: "đã ghi" })
    expect(await payments()).toHaveLength(1)
  })

  it("link đã huỷ (đổi số tiền) vẫn nhận tiền đã quét", async () => {
    const l = await makeLink({ status: "cancelled" })
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000))).toEqual({ status: 200, note: "đã ghi" })
    expect((await db.placePayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("paid")
  })

  it("GV xoá tay dòng payOS rồi payOS gửi lại cùng reference: không ghi lại", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 455000, { reference: "X" }))
    const [p] = await payments()
    await db.placePayment.update({ where: { id: p.id }, data: { isDeleted: true, deletedAt: new Date() } })
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { reference: "X" }))).toEqual({ status: 200, note: "gửi lặp" })
    expect(await db.placePayment.count({ where: { placeId, isDeleted: false } })).toBe(0)
  })

  // FIX AO Task 2: tiền thật đã vào tài khoản GV → vẫn ghi dù nơi đã xoá mềm (tạo lại cùng tên thì hiện lại).
  it("nơi dạy đã xoá mềm: vẫn ghi PlacePayment payOS; gửi lại vẫn 1 dòng", async () => {
    const l = await makeLink()
    await db.teachingPlace.update({ where: { id: placeId }, data: { isDeleted: true, deletedAt: new Date() } })
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { reference: "DEL" }))).toEqual({ status: 200, note: "đã ghi" })
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 455000, { reference: "DEL" }))).toEqual({ status: 200, note: "gửi lặp" })
    const ps = await payments()
    expect(ps).toHaveLength(1)
    expect(ps[0]).toMatchObject({ source: "payos", amount: 455000, isDeleted: false })
    expect(await db.placePayLinkPayment.count({ where: { linkId: l.id } })).toBe(1)
  })
})
