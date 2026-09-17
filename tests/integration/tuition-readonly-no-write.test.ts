import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("tuition.getMonthlyStatusReadOnly", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("trả đúng số tiền nhưng KHÔNG tạo row MonthlyTuition", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({
      fullName: "HS Chỉ Xem", grade: 7, tuitionFee: 100000,
    })
    const s = await caller.session.create({
      sessionDate: "2026-05-12", startTime: "14:00", endTime: "15:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })

    const res = await caller.tuition.getMonthlyStatusReadOnly({
      year: 2026, month: 5, studentId: student.id, limit: 1,
    })

    expect(res.items[0].totalExpected).toBe(100000)
    expect(res.items[0].totalAmountDue).toBe(100000)

    const rows = await db.monthlyTuition.count({ where: { studentId: student.id } })
    expect(rows).toBe(0)
  }, 60000)

  it("bản có persist (getMonthlyStatus) VẪN tạo row — không đổi hành vi trang Học phí", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({
      fullName: "HS Trang Học Phí", grade: 7, tuitionFee: 100000,
    })
    const s = await caller.session.create({
      sessionDate: "2026-05-13", startTime: "14:00", endTime: "15:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })

    await caller.tuition.getMonthlyStatus({
      year: 2026, month: 5, studentId: student.id, limit: 1,
    })

    const rows = await db.monthlyTuition.count({ where: { studentId: student.id } })
    expect(rows).toBe(1)
  }, 60000)
})
