import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { findPaidAmountMismatches } from "../helpers/payment"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { addDays } from "@/lib/plans"
import { signWebhookData } from "@/server/payos"
import { getTuitionNotice } from "@/server/services/tuition-notice.service"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"
import { getMonthlyTuitionStatus } from "@/server/services/tuition.service"
import { listBatches } from "@/server/services/payment.service"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

const HOOK = "H".repeat(43)
let caller: Caller
let userId = 0
let studentId = 0
let original: { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }
let nextHour = 7

async function cleanup() {
  await db.tuitionPayLink.deleteMany()
  await db.teacherPayos.deleteMany()
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function addSession(date: string, fee = 100000) {
  const [subject] = await caller.subject.list({})
  const h = String(nextHour++).padStart(2, "0")
  const s = await caller.session.create({ sessionDate: date, startTime: `${h}:00`, endTime: `${h}:45`, subjectId: subject.id })
  await caller.session.addStudents({ sessionId: s.id, studentIds: [studentId] })
  await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId, attendance: ATTENDANCE_STATUS.PRESENT, fee }] })
}

async function makeLink(over: Partial<{ amount: number; status: string; userId: number; studentId: number }> = {}) {
  return db.tuitionPayLink.create({ data: { userId: over.userId ?? userId, studentId: over.studentId ?? studentId, year: 2026, month: 8, amount: over.amount ?? 200000, status: over.status ?? "active", payosLinkId: `pl-${Math.random()}`, qrCode: "q", checkoutUrl: "c" } })
}
function payload(l: { id: number; payosLinkId: string }, amount: number, reference = `R${l.id}-${amount}`, key = "t-checksum", transactionDateTime = "2026-10-09 14:32:00") {
  const data = { orderCode: l.id, amount, description: `HP ${l.id}`, accountNumber: "0001", reference, transactionDateTime, currency: "VND", paymentLinkId: l.payosLinkId, code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "" }
  return { code: "00", desc: "success", success: true, data, signature: signWebhookData(key, data) }
}
const augMt = () => db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId, year: 2026, month: 8 } } })

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  await cleanup()
  nextHour = 7
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 30) } })
  caller = await getAuthedCaller("teacher")
  studentId = (await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "Trần Thị Bé", grade: 5, tuitionFee: 100000 })).id
  await addSession("2026-08-10")
  await addSession("2026-08-17")
  await db.teacherPayos.create({ data: { userId, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: HOOK } })
})
afterAll(async () => {
  await cleanup()
  await db.user.update({ where: { id: userId }, data: original })
})

describe("webhook payOS học phí (spec AH §6)", () => {
  it("đủ tiền → ghi khoản thu payOS, tháng Đã đóng đủ, link paid, ghi payosPaidAt/Amount", async () => {
    const l = await makeLink()
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 200000))).toMatchObject({ status: 200 })
    const mt = await augMt()
    expect(mt).toMatchObject({ paidAmount: 200000, payosPaidAmount: 200000 })
    expect(mt.payosPaidAt?.toISOString()).toBe("2026-10-09T07:32:00.000Z")
    const p = await db.payment.findFirstOrThrow({ where: { monthlyTuitionId: mt.id } })
    expect(p).toMatchObject({ method: "payos", amount: 200000 })
    expect(p.paidAt.toISOString().slice(0, 10)).toBe("2026-10-09")
    expect((await db.tuitionPayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("paid")
    const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 })
    expect(n.remaining).toBe(0)
  })
  it("chia FIFO: nợ tháng 7 (100.000) + tháng 8 → trả tháng 7 trước", async () => {
    await addSession("2026-07-20")
    const l = await makeLink({ amount: 300000 })
    await handleTuitionWebhook(db, HOOK, payload(l, 300000))
    const rows = await db.payment.findMany({ where: { method: "payos" }, include: { monthlyTuition: { select: { month: true } } }, orderBy: { id: "asc" } })
    expect(rows.map((r) => [r.monthlyTuition.month, r.amount])).toEqual([[7, 100000], [8, 200000]])
    expect(new Set(rows.map((r) => r.batchId)).size).toBe(1)
  })
  it("gửi lặp cùng reference → không ghi lần 2", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    expect(await handleTuitionWebhook(db, HOOK, payload(l, 200000))).toMatchObject({ status: 200 })
    expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
  })
  it("hookId lạ → 404; chữ ký sai → 401; JSON thiếu data → 400", async () => {
    const l = await makeLink()
    expect((await handleTuitionWebhook(db, "x".repeat(43), payload(l, 200000))).status).toBe(404)
    expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000, "R", "khoa-sai"))).status).toBe(401)
    expect((await handleTuitionWebhook(db, HOOK, { foo: 1 })).status).toBe(400)
  })
  it("giao dịch thử (orderCode 123, paymentLinkId không khớp) → 200, không ghi", async () => {
    const data = { orderCode: 123, amount: 3000, description: "VQRIO123", accountNumber: "12345678", reference: "TF230204212323", transactionDateTime: "2023-02-04 18:25:00", currency: "VND", paymentLinkId: "124c33293c43417ab7879e14c8d9eb18", code: "00", desc: "Thành công", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: "", counterAccountNumber: "", virtualAccountName: "", virtualAccountNumber: "" }
    const r = await handleTuitionWebhook(db, HOOK, { code: "00", desc: "success", success: true, data, signature: signWebhookData("t-checksum", data) })
    expect(r.status).toBe(200)
    expect(await db.payment.count()).toBe(0)
  })
  it("data.code khác 00 → 200, không ghi", async () => {
    const l = await makeLink()
    const p = payload(l, 200000)
    const data = { ...p.data, code: "01" }
    const r = await handleTuitionWebhook(db, HOOK, { ...p, data, signature: signWebhookData("t-checksum", data) })
    expect(r.status).toBe(200)
    expect(await db.payment.count()).toBe(0)
  })
  it("link thuộc giáo viên khác → 200 bỏ qua", async () => {
    const other = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    const st2 = await db.student.create({ data: { userId: other.id, fullName: "HS khác", grade: 5 } })
    const l = await makeLink({ userId: other.id, studentId: st2.id })
    expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000))).status).toBe(200)
    expect(await db.payment.count()).toBe(0)
  })
  it("link cancelled (PH quét QR cũ) vẫn ghi, thành tiền dư nếu đã đủ", async () => {
    await caller.payment.create({ studentId, year: 2026, month: 8, amount: 200000, paidAt: "2026-09-01", method: "cash" })
    const l = await makeLink({ status: "cancelled" })
    expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000))).status).toBe(200)
    expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
    expect((await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 })).overpaid).toBeGreaterThanOrEqual(0)
    const paid = await db.payment.aggregate({ where: { isDeleted: false, monthlyTuition: { studentId } }, _sum: { amount: true } })
    expect(paid._sum.amount).toBe(400000)
    expect((await db.tuitionPayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("cancelled")
  })
  it("hết Pro vẫn ghi", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
  })
  it("ngày giao dịch hỏng → ghi với giờ nhận, không lỗi", async () => {
    const l = await makeLink()
    expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000, "RB", "t-checksum", "rác"))).status).toBe(200)
    expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
  })
  it("HS đã xoá mềm → 200 bỏ qua", async () => {
    const l = await makeLink()
    await db.student.update({ where: { id: studentId }, data: { isDeleted: true, deletedAt: new Date() } })
    expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000))).status).toBe(200)
    expect(await db.payment.count()).toBe(0)
  })
  it("2 giao dịch khác reference cộng dồn payosPaidAmount", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 100000, "RA1"))
    await handleTuitionWebhook(db, HOOK, payload(l, 100000, "RA2"))
    expect((await augMt()).payosPaidAmount).toBe(200000)
  })
  it("hiển thị: item tháng có payosPaidAmount, đợt thu có method payos (spec AH §7)", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    const { items } = await getMonthlyTuitionStatus(db, userId, { year: 2026, month: 8, status: "all", page: 1, limit: 10 })
    expect(items.find((i) => i.studentId === studentId)).toMatchObject({ payosPaidAmount: 200000 })
    expect((await listBatches(db, userId, { studentId, year: 2026, month: 8 }))[0]).toMatchObject({ method: "payos" })
  })
  it("2 giáo viên, giao dịch trùng reference (ngân hàng khác nhau) → cả 2 đều được ghi", async () => {
    const other = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    const otherCaller = await getAuthedCaller("teacher_std")
    const st2 = (await otherCaller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS khác", grade: 5, tuitionFee: 100000 })).id
    await db.monthlyTuition.create({ data: { studentId: st2, year: 2026, month: 8 } })
    await db.teacherPayos.create({ data: { userId: other.id, clientId: "o-client", apiKey: "o-api", checksumKey: "o-checksum", hookId: "K".repeat(43) } })
    const l1 = await makeLink()
    const l2 = await makeLink({ userId: other.id, studentId: st2 })
    expect((await handleTuitionWebhook(db, HOOK, payload(l1, 200000, "SAME"))).status).toBe(200)
    expect((await handleTuitionWebhook(db, "K".repeat(43), payload(l2, 50000, "SAME", "o-checksum"))).status).toBe(200)
    expect(await db.payment.count({ where: { method: "payos" } })).toBe(2)
  })
  it("sửa đợt thu payOS (ghi chú) vẫn giữ phương thức payOS", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    const p = await db.payment.findFirstOrThrow({ where: { method: "payos" } })
    await caller.payment.updateBatch({ batchId: p.batchId!, amount: 200000, paidAt: "2026-10-09", note: "sửa" })
    const rows = await db.payment.findMany({ where: { batchId: p.batchId!, isDeleted: false } })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.method === "payos")).toBe(true)
  })
  it("không còn bất biến lệch paidAmount", async () => {
    await addSession("2026-07-20")
    const l = await makeLink({ amount: 300000 })
    await handleTuitionWebhook(db, HOOK, payload(l, 300000))
    await handleTuitionWebhook(db, HOOK, payload(l, 50000, "RX"))
    expect(await findPaidAmountMismatches()).toEqual([])
  })
})
