// Spec AO §3.4: chuông báo tiền gộp khoản HS + khoản nơi dạy, vẫn 20 dòng mới nhất, chưa đọc đếm cả 2 nguồn.
import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { addDays } from "@/lib/plans"
import { signWebhookData } from "@/server/payos"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"
import { listPayosNotices } from "@/server/services/payos-notice.service"
import { PLACE_ORDER_OFFSET } from "@/server/services/place-paylink.service"

const HOOK = "H".repeat(43)
let userId = 0
let studentId = 0
let placeId = 0
let original: { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }

async function cleanup() {
  await db.tuitionPayLink.deleteMany()
  await db.placePayLink.deleteMany()
  await db.teacherPayos.deleteMany()
  await db.payment.deleteMany()
  await db.placePayment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

function signed(data: Record<string, unknown>) {
  const full = { description: "x", accountNumber: "0001", transactionDateTime: "2026-10-09 14:32:00", currency: "VND", code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "", ...data }
  return { code: "00", desc: "success", success: true, data: full, signature: signWebhookData("t-checksum", full) }
}
async function payStudent(reference: string, amount = 1000) {
  const l = (await db.tuitionPayLink.findFirst({ where: { studentId } })) ??
    (await db.tuitionPayLink.create({ data: { userId, studentId, year: 2026, month: 8, amount: 200000, status: "active", payosLinkId: "pl-hs", qrCode: "q", checkoutUrl: "c" } }))
  await handleTuitionWebhook(db, HOOK, signed({ orderCode: l.id, amount, reference, paymentLinkId: l.payosLinkId }))
}
async function payPlace(reference: string, amount = 1000) {
  const l = (await db.placePayLink.findFirst({ where: { placeId } })) ??
    (await db.placePayLink.create({ data: { userId, placeId, year: 2026, month: 9, amount: 455000, status: "active", payosLinkId: "pl-nd", qrCode: "q", checkoutUrl: "c" } }))
  await handleTuitionWebhook(db, HOOK, signed({ orderCode: PLACE_ORDER_OFFSET + l.id, amount, reference, paymentLinkId: l.payosLinkId }))
}

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  await cleanup()
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 30), payosSeenAt: null } })
  const caller = await getAuthedCaller("teacher")
  studentId = (await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "Trần Thị Bé", grade: 5, tuitionFee: 100000 })).id
  const [subject] = await caller.subject.list({})
  const s = await caller.session.create({ sessionDate: "2026-08-10", startTime: "07:00", endTime: "07:45", subjectId: subject.id })
  await caller.session.addStudents({ sessionId: s.id, studentIds: [studentId] })
  await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }] })
  placeId = (await db.teachingPlace.create({ data: { userId, name: "TT Ánh Dương", kind: "center", color: "#0891B2" } })).id
  await db.teacherPayos.create({ data: { userId, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: HOOK } })
})
afterAll(async () => {
  await cleanup()
  await db.user.update({ where: { id: userId }, data: { ...original, payosSeenAt: null } })
})

describe("AO: chuông báo tiền có khoản nơi dạy", () => {
  it("gộp 2 nguồn, sắp theo createdAt mới nhất trước; dòng nơi dạy có tên nơi, tháng, số tiền", async () => {
    await payStudent("S1", 200000)
    await payPlace("P1", 455000)
    const r = await listPayosNotices(db, userId)
    expect(r.unread).toBe(2)
    expect(r.items.map((i) => i.kind)).toEqual(["place", "student"])
    expect(r.items[0]).toMatchObject({ kind: "place", placeId, placeName: "TT Ánh Dương", placeDeleted: false, amount: 455000, year: 2026, month: 9, unread: true })
    expect(r.items[1]).toMatchObject({ kind: "student", studentId, studentName: "Trần Thị Bé", amount: 200000 })
  })

  it("[RF 4] 15 khoản HS + 10 khoản nơi dạy → 20 dòng mới nhất, chưa đọc 25", async () => {
    for (let i = 0; i < 15; i++) await payStudent(`S-${i}`)
    for (let i = 0; i < 10; i++) await payPlace(`P-${i}`)
    const r = await listPayosNotices(db, userId)
    expect(r.items).toHaveLength(20)
    expect(r.unread).toBe(25)
    expect(r.items.filter((i) => i.kind === "place")).toHaveLength(10)
    const times = r.items.map((i) => i.createdAt.getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it("GV xoá tay dòng tiền nơi dạy → mất khỏi chuông và số chưa đọc", async () => {
    await payPlace("P1")
    const p = await db.placePayment.findFirstOrThrow({ where: { placeId } })
    await db.placePayment.update({ where: { id: p.id }, data: { isDeleted: true, deletedAt: new Date() } })
    expect(await listPayosNotices(db, userId)).toMatchObject({ unread: 0, items: [] })
  })

  it("nơi đã xoá mềm → dòng vẫn có, placeDeleted true; đã ngắt payOS mà có lịch sử nơi dạy → enabled", async () => {
    await payPlace("P1")
    await db.teachingPlace.update({ where: { id: placeId }, data: { isDeleted: true, deletedAt: new Date() } })
    await db.teacherPayos.delete({ where: { userId } })
    const r = await listPayosNotices(db, userId)
    expect(r.enabled).toBe(true)
    expect(r.items[0]).toMatchObject({ kind: "place", placeDeleted: true })
  })
})
