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

/**
 * Bộ lọc "Trạng thái" phải trả về đúng những dòng mà badge hiển thị cùng nhóm.
 * Trước đây filter server là bản chép tay, xếp HS trả dư vào 'fully_paid' trong
 * khi badge ghi "Trả dư".
 */
describe("Tuition — bộ lọc trạng thái khớp badge", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("lọc 'unpaid' không trả về HS đã đóng một phần", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const paid = await caller.student.create({ fullName: "HS Đóng Một Phần", grade: 4, tuitionFee: 100000 })
    const owing = await caller.student.create({ fullName: "HS Chưa Đóng", grade: 4, tuitionFee: 100000 })

    const s = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [paid.id, owing.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: paid.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 },
        { studentId: owing.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 },
      ],
    })
    await caller.tuition.updatePayment({
      studentId: paid.id, year: 2026, month: 5, paidAmount: 40000, isFullPaid: false,
    })

    const res = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 5, status: "unpaid", limit: 100,
    })

    const names = res.items.map(i => i.fullName)
    expect(names).toContain("HS Chưa Đóng")
    expect(names).not.toContain("HS Đóng Một Phần")
  }, 60000)

  it("lọc 'fully_paid' bao gồm cả HS trả dư", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const over = await caller.student.create({ fullName: "HS Trả Dư", grade: 5, tuitionFee: 100000 })

    const s = await caller.session.create({
      sessionDate: "2026-05-11", startTime: "10:00", endTime: "11:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [over.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: over.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })
    await caller.tuition.updatePayment({
      studentId: over.id, year: 2026, month: 5, paidAmount: 150000, isFullPaid: false,
    })

    const res = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 5, status: "fully_paid", limit: 100,
    })

    expect(res.items.map(i => i.fullName)).toContain("HS Trả Dư")
  }, 60000)
})
