import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { addDays } from "@/lib/plans"
import { signWebhookData } from "@/server/payos"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"
import { listPayosNotices, markPayosNoticesSeen } from "@/server/services/payos-notice.service"

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

async function makeLink(over: Partial<{ amount: number }> = {}) {
  return db.tuitionPayLink.create({ data: { userId, studentId, year: 2026, month: 8, amount: over.amount ?? 200000, status: "active", payosLinkId: `pl-${Math.random()}`, qrCode: "q", checkoutUrl: "c" } })
}
function payload(l: { id: number; payosLinkId: string }, amount: number, reference = `R${l.id}-${amount}`) {
  const data = { orderCode: l.id, amount, description: `HP ${l.id}`, accountNumber: "0001", reference, transactionDateTime: "2026-10-09 14:32:00", currency: "VND", paymentLinkId: l.payosLinkId, code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "" }
  return { code: "00", desc: "success", success: true, data, signature: signWebhookData("t-checksum", data) }
}

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  await cleanup()
  nextHour = 7
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 30), payosSeenAt: null } })
  caller = await getAuthedCaller("teacher")
  studentId = (await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "Trần Thị Bé", grade: 5, tuitionFee: 100000 })).id
  await addSession("2026-08-10")
  await addSession("2026-08-17")
  await db.teacherPayos.create({ data: { userId, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: HOOK } })
})
afterAll(async () => {
  await cleanup()
  await db.user.update({ where: { id: userId }, data: { ...original, payosSeenAt: null } })
})

describe("thông báo tiền payOS (spec AI §3-4)", () => {
  it("chưa nối payOS, chưa có lịch sử → enabled false, rỗng", async () => {
    await db.teacherPayos.deleteMany({ where: { userId } })
    expect(await listPayosNotices(db, userId)).toEqual({ enabled: false, unread: 0, items: [] })
  })
  it("đã nối, chưa có tiền → enabled true, rỗng", async () => {
    expect(await listPayosNotices(db, userId)).toEqual({ enabled: true, unread: 0, items: [] })
  })
  it("có tiền → item đủ trường, tên HS giải mã, chưa đọc", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    const r = await listPayosNotices(db, userId)
    expect(r.unread).toBe(1)
    expect(r.items[0]).toMatchObject({ studentId, studentName: "Trần Thị Bé", studentDeleted: false, amount: 200000, year: 2026, month: 8, unread: true })
    expect(r.items[0].paidAt.toISOString()).toBe("2026-10-09T07:32:00.000Z")
  })
  it("đợt thu đã xoá → không còn trong danh sách và số chưa đọc", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    const p = await db.payment.findFirstOrThrow({ where: { method: "payos" } })
    await caller.payment.deleteBatch({ batchId: p.batchId! })
    expect(await listPayosNotices(db, userId)).toMatchObject({ unread: 0, items: [] })
  })
  it("đã ngắt payOS nhưng có lịch sử → enabled true", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    await db.teacherPayos.delete({ where: { userId } })
    expect((await listPayosNotices(db, userId)).enabled).toBe(true)
  })
  it("chỉ 20 dòng mới nhất, unread đếm hết", async () => {
    const l = await makeLink({ amount: 1000 })
    for (let i = 0; i < 22; i++) await handleTuitionWebhook(db, HOOK, payload(l, 1000, `R-${i}`))
    const r = await listPayosNotices(db, userId)
    expect(r.items).toHaveLength(20)
    expect(r.unread).toBe(22)
    expect(r.items[0].createdAt >= r.items[19].createdAt).toBe(true)
  })
  it("mỗi lần hỏi chỉ đọc (và giải mã tên) tối đa 20 dòng; đợt đã xoá không chiếm chỗ (review AI #4)", async () => {
    const l = await makeLink({ amount: 1000 })
    for (let i = 0; i < 24; i++) await handleTuitionWebhook(db, HOOK, payload(l, 1000, `R-${i}`))
    const newest = await db.tuitionPayLinkPayment.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2 })
    for (const n of newest) await caller.payment.deleteBatch({ batchId: n.batchId })
    const spy = vi.spyOn(db.tuitionPayLinkPayment, "findMany")
    const r = await listPayosNotices(db, userId)
    const sizes = await Promise.all(spy.mock.results.map((x) => x.value as Promise<unknown[]>))
    spy.mockRestore()
    expect(sizes.every((rows) => rows.length <= 20)).toBe(true)
    expect(r.items).toHaveLength(20)
    expect(r.items.map((i) => i.id)).not.toContain(newest[0].id)
    expect(r.unread).toBe(22)
  })
  it("chỉ thông báo của mình", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    const other = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    expect(await listPayosNotices(db, other.id)).toEqual({ enabled: false, unread: 0, items: [] })
  })
  it("markSeen theo upTo: khoản mới hơn upTo vẫn chưa đọc; không lùi mốc", async () => {
    const l = await makeLink({ amount: 1000 })
    await handleTuitionWebhook(db, HOOK, payload(l, 1000, "A"))
    const first = (await listPayosNotices(db, userId)).items[0]
    await handleTuitionWebhook(db, HOOK, payload(l, 1000, "B"))
    await markPayosNoticesSeen(db, userId, first.createdAt)
    const r = await listPayosNotices(db, userId)
    expect(r.unread).toBe(1)
    expect(r.items.find((i) => i.unread)?.id).not.toBe(first.id)
    await markPayosNoticesSeen(db, userId, new Date("2020-01-01"))
    expect((await listPayosNotices(db, userId)).unread).toBe(1)
  })
  it("markSeen upTo ở tương lai → dùng giờ hiện tại", async () => {
    const { seenAt } = await markPayosNoticesSeen(db, userId, new Date(Date.now() + 3600_000))
    expect(seenAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
  })
  it("HS đã xoá mềm → studentDeleted true", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    await db.student.update({ where: { id: studentId }, data: { isDeleted: true, deletedAt: new Date() } })
    expect((await listPayosNotices(db, userId)).items[0].studentDeleted).toBe(true)
  })
  it("router: list + markSeen qua caller", async () => {
    const l = await makeLink()
    await handleTuitionWebhook(db, HOOK, payload(l, 200000))
    const r = await caller.payosNotice.list()
    await caller.payosNotice.markSeen({ upTo: new Date(r.items[0].createdAt).toISOString() })
    expect((await caller.payosNotice.list()).unread).toBe(0)
  })
})
