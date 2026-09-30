import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getParentView } from "@/server/services/parent-link.service"
import { getAuthedCaller } from "../helpers/trpc"

const D = "2031-04-07"
const TOKEN = "r".repeat(43)

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany({ where: { name: { not: "Tiếng Anh" } } })
}

async function subjectId(caller: Awaited<ReturnType<typeof getAuthedCaller>>) {
  return (await caller.subject.list({})).find((s) => s.isDefault)!.id
}

describe("Dọn Thùng rác (spec R4–R7)", () => {
  beforeEach(clean)

  it("dọn ca: xoá cứng ca + link, ca sống không đụng", async () => {
    const caller = await getAuthedCaller()
    const sid = await subjectId(caller)
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Ca", grade: 3 })
    const a = await caller.session.create({ sessionDate: D, startTime: "08:00", endTime: "09:00", subjectId: sid, studentIds: [st.id] })
    const b = await caller.session.create({ sessionDate: D, startTime: "10:00", endTime: "11:00", subjectId: sid })
    await caller.session.delete({ id: a.id })
    expect(await caller.trash.purge({ type: "session" })).toEqual({ purged: { session: 1, student: 0, payment: 0, subject: 0 } })
    expect(await db.teachingSession.findUnique({ where: { id: a.id, isDeleted: undefined } })).toBeNull()
    expect(await db.sessionStudent.count({ where: { sessionId: a.id } })).toBe(0)
    expect(await db.teachingSession.findUnique({ where: { id: b.id } })).not.toBeNull()
  })

  it("dọn lần thu: xoá cứng, paidAmount không đổi", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Thu", grade: 6 })
    await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 50_000, paidAt: "2030-05-20", method: "cash" })
    const p = await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 20_000, paidAt: "2030-05-21", method: "cash" })
    await caller.payment.delete({ id: p.id })
    await caller.trash.purge({ type: "payment" })
    expect(await db.payment.findUnique({ where: { id: p.id, isDeleted: undefined } })).toBeNull()
    const mt = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId: st.id, year: 2030, month: 5 } } })
    expect(mt.paidAmount).toBe(50_000)
  })

  it("dọn HS: ẩn danh, giữ lần thu/học phí/điểm danh, link phụ huynh chết, không còn trong Thùng rác, khôi phục → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const sid = await subjectId(caller)
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Ẩn", grade: 6, tuitionFee: 80_000, parentPhone: "0901234567", parentName: "Chị Ẩn", notes: "ghi chú" })
    const s = await caller.session.create({ sessionDate: "2024-05-06", startTime: "08:00", endTime: "09:00", subjectId: sid, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: 2024, month: 5, amount: 80_000, paidAt: "2024-05-20", method: "cash" })
    await db.student.update({ where: { id: st.id }, data: { parentLinkToken: TOKEN } })
    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })

    expect(await caller.trash.purge({ type: "student" })).toMatchObject({ purged: { student: 1 } })
    const row = await db.student.findUniqueOrThrow({ where: { id: st.id, isDeleted: true } })
    expect(row).toMatchObject({ fullName: "Học sinh đã xoá", parentPhone: null, parentName: null, notes: null, parentLinkToken: null })
    expect(row.purgedAt).toBeInstanceOf(Date)
    expect(await db.payment.count({ where: { monthlyTuition: { studentId: st.id } } })).toBe(1)
    expect(await db.sessionStudent.count({ where: { studentId: st.id } })).toBe(1)
    expect(await getParentView(db, TOKEN, "2024-05")).toBeNull()
    expect(await caller.trash.counts()).toMatchObject({ student: 0 })
    expect((await caller.trash.list({ type: "student" })).totalCount).toBe(0)
    await expect(caller.trash.restore({ type: "student", id: st.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("dọn môn: không còn ca → mất hẳn; còn ca đã xoá → purgedAt, biến khỏi Thùng rác", async () => {
    const caller = await getAuthedCaller()
    const ly = await caller.subject.create({ name: "Lý", color: "#D97706" })
    const hoa = await caller.subject.create({ name: "Hoá", color: "#16A34A" })
    const s = await caller.session.create({ sessionDate: D, startTime: "13:00", endTime: "14:00", subjectId: hoa.id })
    await caller.session.delete({ id: s.id })
    await caller.subject.delete({ id: ly.id })
    await caller.subject.delete({ id: hoa.id })

    expect(await caller.trash.purge({ type: "subject" })).toMatchObject({ purged: { subject: 2 } })
    expect(await db.subject.findUnique({ where: { id: ly.id, isDeleted: undefined } })).toBeNull()
    const h = await db.subject.findUniqueOrThrow({ where: { id: hoa.id, isDeleted: true } })
    expect(h.purgedAt).toBeInstanceOf(Date)
    expect(await caller.trash.counts()).toMatchObject({ subject: 0 })
    await expect(caller.trash.restore({ type: "subject", id: hoa.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("dọn sạch: cả 4 loại; dọn lần 2 → 0", async () => {
    const caller = await getAuthedCaller()
    const sid = await subjectId(caller)
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Sạch", grade: 3 })
    const s = await caller.session.create({ sessionDate: D, startTime: "15:00", endTime: "16:00", subjectId: sid })
    const ly = await caller.subject.create({ name: "Lý", color: "#D97706" })
    await caller.session.delete({ id: s.id })
    await caller.student.delete({ id: st.id })
    await caller.subject.delete({ id: ly.id })

    expect(await caller.trash.purgeAll()).toEqual({ purged: { session: 1, student: 1, payment: 0, subject: 1 } })
    expect(await caller.trash.counts()).toEqual({ session: 0, student: 0, payment: 0, subject: 0 })
    expect(await caller.trash.purgeAll()).toEqual({ purged: { session: 0, student: 0, payment: 0, subject: 0 } })
  })

  it("môn đã dọn (còn ca đã xoá giữ lại) không chiếm tên: tạo lại môn cùng tên được", async () => {
    const caller = await getAuthedCaller()
    const hoa = await caller.subject.create({ name: "Hoá", color: "#16A34A" })
    const s = await caller.session.create({ sessionDate: D, startTime: "13:00", endTime: "14:00", subjectId: hoa.id })
    await caller.session.delete({ id: s.id })
    await caller.subject.delete({ id: hoa.id })
    await caller.trash.purge({ type: "subject" })
    const again = await caller.subject.create({ name: "Hoá", color: "#16A34A" })
    expect(again.id).not.toBe(hoa.id)
  })

  it("chỉ dọn của mình", async () => {
    const caller = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Riêng", grade: 3 })
    await caller.student.delete({ id: st.id })
    expect(await other.trash.purgeAll()).toMatchObject({ purged: { student: 0 } })
    expect(await caller.trash.counts()).toMatchObject({ student: 1 })
  })
})
