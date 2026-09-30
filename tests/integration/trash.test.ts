import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { studentLimit } from "@/lib/plans"
import { getAuthedCaller } from "../helpers/trpc"

const D = "2031-04-07"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany({ where: { name: { not: "Tiếng Anh" } } })
}

async function defaultSubjectId(caller: Awaited<ReturnType<typeof getAuthedCaller>>) {
  return (await caller.subject.list({})).find((s) => s.isDefault)!.id
}

describe("Thùng rác (spec Q mục 7)", () => {
  beforeEach(clean)

  it("counts + list theo loại, mới xoá lên đầu, phân trang, chỉ của mình", async () => {
    const caller = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS A", grade: 3 })
    const b = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS B", grade: 4 })
    await caller.student.delete({ id: a.id })
    await caller.student.delete({ id: b.id })

    expect(await caller.trash.counts()).toEqual({ session: 0, student: 2, payment: 0, subject: 0 })
    const page1 = await caller.trash.list({ type: "student", page: 1, limit: 1 })
    expect(page1).toMatchObject({ totalCount: 2, totalPages: 2 })
    expect(page1.items[0]).toMatchObject({ type: "student", id: b.id, fullName: "HS B", grade: 4 })
    expect((await other.trash.list({ type: "student" })).totalCount).toBe(0)
    await expect(other.trash.restore({ type: "student", id: a.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("khôi phục HS → hiện lại, khôi phục lần 2 → NOT_FOUND; HS chưa xoá → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS A", grade: 3 })
    await expect(caller.trash.restore({ type: "student", id: a.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await caller.student.delete({ id: a.id })
    await caller.trash.restore({ type: "student", id: a.id })
    expect((await caller.student.list({})).items.map((s) => s.id)).toContain(a.id)
    await expect(caller.trash.restore({ type: "student", id: a.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("khôi phục HS đang học vượt giới hạn gói → lỗi gói, vẫn trong thùng rác", async () => {
    const caller = await getAuthedCaller("teacher_std")
    const userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
    const limit = studentLimit("standard")!
    const x = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS X", grade: 3 })
    await caller.student.delete({ id: x.id })
    await db.student.createMany({ data: Array.from({ length: limit }, (_, i) => ({ userId, fullName: `Đầy ${i}`, grade: 1 })) })
    await expect(caller.trash.restore({ type: "student", id: x.id })).rejects.toThrow(/tối đa/)
    expect(await db.student.findUnique({ where: { id: x.id, isDeleted: true } })).not.toBeNull()
  })

  it("khôi phục ca: trùng giờ → CONFLICT; môn đang xoá → CONFLICT; hợp lệ → về lịch", async () => {
    const caller = await getAuthedCaller()
    const subjectId = await defaultSubjectId(caller)
    const s = await caller.session.create({ sessionDate: D, startTime: "08:00", endTime: "09:00", subjectId })
    await caller.session.delete({ id: s.id })
    const blocker = await caller.session.create({ sessionDate: D, startTime: "08:30", endTime: "09:30", subjectId })
    await expect(caller.trash.restore({ type: "session", id: s.id })).rejects.toMatchObject({ code: "CONFLICT" })
    await caller.session.delete({ id: blocker.id })

    const lyId = (await caller.subject.create({ name: "Lý", color: "#D97706" })).id
    const s2 = await caller.session.create({ sessionDate: D, startTime: "13:00", endTime: "14:00", subjectId: lyId })
    await caller.session.delete({ id: s2.id })
    await caller.subject.delete({ id: lyId })
    await expect(caller.trash.restore({ type: "session", id: s2.id })).rejects.toThrow(/Môn Lý đang ở Thùng rác/)
    await caller.trash.restore({ type: "subject", id: lyId })
    await caller.trash.restore({ type: "session", id: s2.id })

    await caller.trash.restore({ type: "session", id: s.id })
    const month = await caller.session.getMonth({ year: 2031, month: 4 })
    expect(month.map((x) => x.id)).toEqual(expect.arrayContaining([s.id, s2.id]))
  })

  it("ca tương lai đang ở thùng rác cũng gỡ HS cho nghỉ → khôi phục ca không đưa HS nghỉ quay lại", async () => {
    const caller = await getAuthedCaller()
    const subjectId = await defaultSubjectId(caller)
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS A", grade: 3 })
    const s = await caller.session.create({ sessionDate: D, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id] })
    await caller.session.delete({ id: s.id })
    await caller.student.deactivate({ id: a.id })
    await caller.trash.restore({ type: "session", id: s.id })
    expect(await db.sessionStudent.count({ where: { sessionId: s.id, studentId: a.id } })).toBe(0)
  })

  it("ca huỷ không bị kiểm trùng; ca bù: ca gốc đã khôi phục (không còn huỷ) → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const subjectId = await defaultSubjectId(caller)
    const s = await caller.session.create({ sessionDate: D, startTime: "08:00", endTime: "09:00", subjectId })
    const { makeup } = await caller.session.createMakeup({ id: s.id, sessionDate: "2031-04-14", startTime: "08:00", endTime: "09:00" })
    await caller.session.restore({ id: s.id }) // ca bù vào thùng rác (Task 2)
    await expect(caller.trash.restore({ type: "session", id: makeup.id })).rejects.toThrow(/Ca gốc/)

    const c = await caller.session.create({ sessionDate: D, startTime: "18:00", endTime: "19:00", subjectId })
    await caller.session.createMakeup({ id: c.id, sessionDate: "2031-04-21", startTime: "18:00", endTime: "19:00" })
    await caller.session.delete({ id: c.id }) // ca gốc đã huỷ
    await caller.session.create({ sessionDate: D, startTime: "18:00", endTime: "19:00", subjectId })
    await caller.trash.restore({ type: "session", id: c.id }) // huỷ → không chặn trùng giờ
  })

  it("khôi phục lần thu: paidAmount cộng lại; HS đang xoá → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Thu", grade: 6 })
    const p = await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 70_000, paidAt: "2030-05-20", method: "cash" })
    await caller.payment.delete({ id: p.id })
    const list = await caller.trash.list({ type: "payment" })
    expect(list.items[0]).toMatchObject({ type: "payment", id: p.id, amount: 70_000, paidAt: "2030-05-20", studentName: "HS Thu", year: 2030, month: 5 })

    await caller.student.delete({ id: st.id })
    await expect(caller.trash.restore({ type: "payment", id: p.id })).rejects.toThrow(/Học sinh HS Thu đang ở Thùng rác/)
    await caller.trash.restore({ type: "student", id: st.id })
    await caller.trash.restore({ type: "payment", id: p.id })
    const mt = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId: st.id, year: 2030, month: 5 } } })
    expect(mt.paidAmount).toBe(70_000)
  })

  it("list ca trả field thô đúng định dạng", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.session.create({ sessionDate: D, startTime: "07:15", endTime: "08:45", subjectId: await defaultSubjectId(caller), title: "Ôn thi" })
    await caller.session.delete({ id: s.id })
    const [item] = (await caller.trash.list({ type: "session" })).items
    expect(item).toMatchObject({ type: "session", id: s.id, sessionDate: D, startTime: "07:15", endTime: "08:45", subjectName: "Tiếng Anh", title: "Ôn thi", isMakeup: false })
    expect(item.deletedAt).toBeInstanceOf(Date)
  })
})
