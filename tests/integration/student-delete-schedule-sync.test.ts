import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

// Định dạng Date -> "YYYY-MM-DD" theo UTC (khớp parseSessionDate dùng Date.UTC).
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`
}

// Ngày tương đối so với hôm nay để test không phụ thuộc thời điểm chạy.
function daysFromNow(delta: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + delta)
  return ymd(d)
}

describe("Xóa học sinh ↔ đồng bộ lịch & giữ điểm danh", () => {
  let subjectId: number

  beforeAll(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.student.deleteMany()
    await db.subject.deleteMany()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.student.deleteMany()
  })

  // ── Bug 1: xóa HS phải gỡ khỏi buổi tương lai ────────────────────
  it("✓ xóa HS → gỡ khỏi buổi học tương lai (sessionDate >= hôm nay)", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ fullName: "HS Bình", grade: 5 })

    const future = await caller.session.create({
      sessionDate: daysFromNow(40),
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [a.id, b.id],
    })
    expect(future.studentCount).toBe(2)

    await caller.student.delete({ id: a.id })

    const detail = await caller.session.getDetail({ id: future.id })
    expect(detail.studentCount).toBe(1)
    expect(detail.students.map((s) => s.studentId)).toEqual([b.id])
  })

  // ── Bug 1: buổi quá khứ phải giữ nguyên (bảo toàn lịch sử) ───────
  it("✓ xóa HS → KHÔNG đụng buổi quá khứ (giữ lịch sử & doanh thu)", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ fullName: "HS Bình", grade: 5 })

    const past = await caller.session.create({
      sessionDate: daysFromNow(-40),
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [a.id, b.id],
    })

    await caller.student.delete({ id: a.id })

    const detail = await caller.session.getDetail({ id: past.id })
    expect(detail.studentCount).toBe(2)
    expect(detail.students.map((s) => s.studentId).sort()).toEqual([a.id, b.id].sort())
  })

  // ── Bug 2: bỏ 1 HS qua addStudents phải giữ điểm danh HS còn lại ──
  it("✓ addStudents bỏ 1 HS → KHÔNG reset điểm danh HS còn lại", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ fullName: "HS Bình", grade: 5 })
    const c = await caller.student.create({ fullName: "HS Cường", grade: 5 })

    const s = await caller.session.create({
      sessionDate: daysFromNow(10),
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [a.id, b.id, c.id],
    })

    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: a.id, attendance: "present" },
        { studentId: b.id, attendance: "absent" },
        { studentId: c.id, attendance: "late" },
      ],
    })

    // Bỏ A khỏi danh sách (giữ B, C)
    await caller.session.addStudents({ sessionId: s.id, studentIds: [b.id, c.id] })

    const detail = await caller.session.getDetail({ id: s.id })
    const byId = Object.fromEntries(detail.students.map((st) => [st.studentId, st.attendance]))
    expect(detail.studentCount).toBe(2)
    expect(byId[b.id]).toBe("absent")
    expect(byId[c.id]).toBe("late")
  })

  // ── Gỡ 1 HS qua removeStudent phải giữ điểm danh HS còn lại ──────
  it("✓ removeStudent gỡ 1 HS → KHÔNG đụng điểm danh HS còn lại", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ fullName: "HS Bình", grade: 5 })
    const c = await caller.student.create({ fullName: "HS Cường", grade: 5 })

    const s = await caller.session.create({
      sessionDate: daysFromNow(14),
      startTime: "14:00",
      endTime: "15:30",
      subjectId,
      studentIds: [a.id, b.id, c.id],
    })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: a.id, attendance: "present" },
        { studentId: b.id, attendance: "absent" },
        { studentId: c.id, attendance: "late" },
      ],
    })

    await caller.session.removeStudent({ sessionId: s.id, studentId: a.id })

    const detail = await caller.session.getDetail({ id: s.id })
    const byId = Object.fromEntries(detail.students.map((st) => [st.studentId, st.attendance]))
    expect(detail.studentCount).toBe(2)
    expect(byId[a.id]).toBeUndefined()
    expect(byId[b.id]).toBe("absent")
    expect(byId[c.id]).toBe("late")
  })

  // ── Bug 2: thêm HS qua update phải giữ điểm danh HS cũ ───────────
  it("✓ update thêm HS mới → giữ điểm danh HS cũ, HS mới = pending", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "HS An", grade: 5 })
    const b = await caller.student.create({ fullName: "HS Bình", grade: 5 })

    const s = await caller.session.create({
      sessionDate: daysFromNow(12),
      startTime: "10:00",
      endTime: "11:30",
      subjectId,
      studentIds: [a.id],
    })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: a.id, attendance: "present" }],
    })

    await caller.session.update({ id: s.id, data: { studentIds: [a.id, b.id] } })

    const detail = await caller.session.getDetail({ id: s.id })
    const byId = Object.fromEntries(detail.students.map((st) => [st.studentId, st.attendance]))
    expect(detail.studentCount).toBe(2)
    expect(byId[a.id]).toBe("present")
    expect(byId[b.id]).toBe("pending")
  })
})
