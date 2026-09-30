import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { softDeleteData } from "@/server/soft-delete"
import { getCancelledWithoutMakeup } from "@/server/services/session.service"
import { getAuthedCaller } from "../helpers/trpc"

// Ngày xa trong tương lai để không đụng luật "ca đã kết thúc".
const D1 = "2031-03-03" // thứ Hai
const D2 = "2031-03-10"
const D3 = "2031-03-17"

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("Ca dạy xoá mềm (spec Q X1–X3)", () => {
  let subjectId: number
  let userId: number

  beforeAll(async () => {
    await clean()
    await db.subject.deleteMany()
    const caller = await getAuthedCaller()
    subjectId = (await caller.subject.create({ name: "Toán", color: "#0891B2" })).id
    userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
  })
  beforeEach(clean)

  it("xoá ca lẻ: row còn, isDeleted + deletedAt, link HS giữ; biến khỏi lịch; getDetail/update → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    const s = await caller.session.create({ sessionDate: D1, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id] })

    await caller.session.delete({ id: s.id })

    const row = await db.teachingSession.findUnique({ where: { id: s.id, isDeleted: true } })
    expect(row?.deletedAt).toBeInstanceOf(Date)
    expect(await db.sessionStudent.count({ where: { sessionId: s.id } })).toBe(1)
    const month = await caller.session.getMonth({ year: 2031, month: 3 })
    expect(month.map((x) => x.id)).not.toContain(s.id)
    await expect(caller.session.getDetail({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.session.update({ id: s.id, data: { title: "x" } })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.session.delete({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("xoá chuỗi tương lai: xoá mềm cùng deletedAt, gọi lại không đếm ca đã xoá", async () => {
    const caller = await getAuthedCaller()
    await caller.session.bulkCreate({ startDate: D1, endDate: D3, weekdays: [0], startTime: "10:00", endTime: "11:00", subjectId })
    const [first] = await caller.session.getMonth({ year: 2031, month: 3 })
    const res = await caller.session.deleteFuture({ id: first.id })
    expect(res.deleted).toBe(3)
    const rows = await db.teachingSession.findMany({ where: { userId, isDeleted: true }, select: { deletedAt: true } })
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((r) => r.deletedAt?.getTime())).size).toBe(1)
  })

  it("ca đã xoá không chặn trùng giờ: tạo lẻ, kiểm hàng loạt, sửa chuỗi", async () => {
    const caller = await getAuthedCaller()
    const old = await caller.session.create({ sessionDate: D1, startTime: "08:00", endTime: "09:00", subjectId })
    await caller.session.delete({ id: old.id })
    const fresh = await caller.session.create({ sessionDate: D1, startTime: "08:00", endTime: "09:00", subjectId })
    expect(fresh.id).not.toBe(old.id)
    await caller.session.delete({ id: fresh.id })
    const conflicts = await caller.session.checkBulkConflicts({ startDate: D1, endDate: D1, weekdays: [0], startTime: "08:30", endTime: "09:30", subjectId })
    expect(conflicts).toEqual([])
  })

  it("HS đã xoá: không hiện trong chi tiết ca / đếm / điểm danh; sửa ca không gỡ link của HS đó", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Bình", grade: 5 })
    const s = await caller.session.create({ sessionDate: D1, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id, b.id] })
    await db.student.update({ where: { id: a.id }, data: softDeleteData() })

    const detail = await caller.session.getDetail({ id: s.id })
    expect(detail.students.map((x) => x.studentId)).toEqual([b.id])
    expect(detail.studentCount).toBe(1)
    const month = await caller.session.getMonth({ year: 2031, month: 3 })
    expect(month.find((x) => x.id === s.id)?.studentCount).toBe(1)
    const att = await caller.attendance.get({ sessionId: s.id })
    expect(att.map((x) => x.studentId)).toEqual([b.id])

    // Form sửa ca chỉ gửi HS đang thấy (b) → link của a phải còn để khôi phục a.
    await caller.session.update({ id: s.id, data: { studentIds: [b.id] } })
    expect(await db.sessionStudent.count({ where: { sessionId: s.id, studentId: a.id } })).toBe(1)
  })

  it("nhân bản / tạo ca bù từ ca có HS đã xoá: không lỗi, chỉ chép HS còn", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Bình", grade: 5 })
    const s = await caller.session.create({ sessionDate: D1, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id, b.id] })
    await db.student.update({ where: { id: a.id }, data: softDeleteData() })

    const dup = await caller.session.duplicate({ id: s.id, targetDate: D2 })
    expect(dup.students.map((x) => x.studentId)).toEqual([b.id])
    const { makeup } = await caller.session.createMakeup({ id: s.id, sessionDate: D3, startTime: "08:00", endTime: "09:00" })
    expect(makeup.students.map((x) => x.studentId)).toEqual([b.id])
  })

  it("khôi phục ca huỷ xoá mềm ca bù; ca bù bị xoá → ca huỷ hiện ở 'chưa dạy bù'; ca gốc đã xoá → originalInfo null", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.session.create({ sessionDate: D1, startTime: "08:00", endTime: "09:00", subjectId })
    const { makeup } = await caller.session.createMakeup({ id: s.id, sessionDate: D2, startTime: "08:00", endTime: "09:00" })

    await caller.session.delete({ id: makeup.id })
    const pending = await getCancelledWithoutMakeup(db, userId, { from: new Date(Date.UTC(2031, 0, 1)) })
    expect(pending.map((x) => x.id)).toContain(s.id)

    await db.teachingSession.update({ where: { id: makeup.id }, data: { isDeleted: false, deletedAt: null } })
    await caller.session.restore({ id: s.id })
    expect(await db.teachingSession.findUnique({ where: { id: makeup.id, isDeleted: true } })).not.toBeNull()

    const s2 = await caller.session.create({ sessionDate: D3, startTime: "13:00", endTime: "14:00", subjectId })
    const { makeup: m2 } = await caller.session.createMakeup({ id: s2.id, sessionDate: D3, startTime: "15:00", endTime: "16:00" })
    await db.teachingSession.update({ where: { id: s2.id }, data: softDeleteData() })
    expect((await caller.session.getDetail({ id: m2.id })).originalInfo).toBeNull()
  })
})
