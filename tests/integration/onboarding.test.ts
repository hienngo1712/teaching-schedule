import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { CONSENT_ACCEPTED } from "@/lib/consent"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ where: { username: { in: ["teacher", "teacher2"] } }, data: { onboardingDismissedAt: null, bankAccountNumber: null, bankBin: null, bankAccountName: null } })
}

const NONE = { student: false, session: false, attendance: false, payment: false, bank: false }

describe("onboarding (spec W §4)", () => {
  beforeEach(clean)

  it("chưa có gì → 5 bước false, chưa ẩn", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.onboarding.status()).toEqual({ dismissed: false, steps: NONE })
  })

  it("tick theo dữ liệu thật, không lẫn user khác", async () => {
    const caller = await getAuthedCaller("teacher")
    const other = await getAuthedCaller("teacher2")
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W1", grade: 5, tuitionFee: 100_000 })
    const today = new Date().toISOString().slice(0, 10)
    const ses = await caller.session.create({ sessionDate: today, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [st.id] })
    let s = await caller.onboarding.status()
    expect(s.steps).toMatchObject({ student: true, session: true, attendance: false, payment: false, bank: false })
    expect((await other.onboarding.status()).steps).toEqual(NONE)

    await db.sessionStudent.updateMany({ where: { sessionId: ses.id }, data: { attendance: "present" } })
    await db.user.update({ where: { username: "teacher" }, data: { bankAccountNumber: "0123456789" } })
    s = await caller.onboarding.status()
    expect(s.steps).toMatchObject({ attendance: true, bank: true })
  })

  it("HS và ca đã xoá mềm, điểm danh của ca đã xoá không tính", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W2", grade: 5, tuitionFee: 100_000 })
    const today = new Date().toISOString().slice(0, 10)
    const ses = await caller.session.create({ sessionDate: today, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
    await db.sessionStudent.updateMany({ where: { sessionId: ses.id }, data: { attendance: "present" } })
    await db.teachingSession.update({ where: { id: ses.id }, data: { isDeleted: true, deletedAt: new Date() } })
    await db.student.update({ where: { id: st.id }, data: { isDeleted: true, deletedAt: new Date() } })
    expect((await caller.onboarding.status()).steps).toEqual(NONE)
  })

  it("payment tick khi có phiếu thu tiền thật sự", async () => {
    const caller = await getAuthedCaller("teacher")
    const other = await getAuthedCaller("teacher2")
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W Pay", grade: 5, tuitionFee: 100_000 })
    await caller.payment.create({ studentId: st.id, year: 2026, month: 5, amount: 100_000, paidAt: "2026-05-10", method: "cash" })
    const s = await caller.onboarding.status()
    expect(s.steps.payment).toBe(true)
    expect((await other.onboarding.status()).steps.payment).toBe(false)
  })

  it("dismiss → dismissed true, chỉ ảnh hưởng chính mình", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.onboarding.dismiss()).toEqual({ ok: true })
    expect((await caller.onboarding.status()).dismissed).toBe(true)
    expect((await (await getAuthedCaller("teacher2")).onboarding.status()).dismissed).toBe(false)
  })
})
