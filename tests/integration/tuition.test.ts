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

describe("Tuition Management", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("✓ getMonthlyStatus → tính toán totalExpected dựa trên điểm danh", async () => {
    const caller = await getAuthedCaller()
    
    // 1. Setup student
    const student = await caller.student.create({
      fullName: "Nguyễn Văn An",
      grade: 3,
      tuitionFee: 100000,
    })

    // 2. Setup subject
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    // 3. Setup sessions in May 2026
    const session1 = await caller.session.create({
      sessionDate: "2026-05-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    const session2 = await caller.session.create({
      sessionDate: "2026-05-12",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    const session3 = await caller.session.create({
      sessionDate: "2026-05-14",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })

    // Assign student to sessions
    await caller.session.addStudents({
      sessionId: session1.id,
      studentIds: [student.id],
    })
    await caller.session.addStudents({
      sessionId: session2.id,
      studentIds: [student.id],
    })
    await caller.session.addStudents({
      sessionId: session3.id,
      studentIds: [student.id],
    })

    // 4. Update attendance
    // Session 1: PRESENT (100k)
    // Session 2: LATE (100k)
    // Session 3: ABSENT (0k)
    await caller.attendance.update({
      sessionId: session1.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })
    await caller.attendance.update({
      sessionId: session2.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.LATE, fee: 100000 }],
    })
    await caller.attendance.update({
      sessionId: session3.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.ABSENT, fee: 0 }],
    })

    // 5. Query monthly status
    const status = await caller.tuition.getMonthlyStatus({
      year: 2026,
      month: 5,
    })

    expect(status).toHaveLength(1)
    expect(status[0].fullName).toBe("Nguyễn Văn An")
    expect(status[0].totalSessions).toBe(3)
    expect(status[0].presentSessions).toBe(2)
    expect(status[0].totalExpected).toBe(200000)
    expect(status[0].paidAmount).toBe(0)
    expect(status[0].isFullPaid).toBe(false)
  })

  it("✓ updatePayment → lưu thông tin đóng tiền", async () => {
    const caller = await getAuthedCaller()
    const student = await caller.student.create({ fullName: "An", grade: 3 })

    await caller.tuition.updatePayment({
      studentId: student.id,
      year: 2026,
      month: 5,
      paidAmount: 150000,
      isFullPaid: false,
      notes: "Mới đóng một nửa",
    })

    const status = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    expect(status[0].paidAmount).toBe(150000)
    expect(status[0].isFullPaid).toBe(false)
    expect(status[0].notes).toBe("Mới đóng một nửa")

    // Update again (upsert test)
    await caller.tuition.updatePayment({
      studentId: student.id,
      year: 2026,
      month: 5,
      paidAmount: 200000,
      isFullPaid: true,
      notes: "Đã đóng đủ",
    })

    const updatedStatus = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    expect(updatedStatus[0].paidAmount).toBe(200000)
    expect(updatedStatus[0].isFullPaid).toBe(true)
    expect(updatedStatus[0].notes).toBe("Đã đóng đủ")
  })

  it("✗ updatePayment student của user khác → NOT_FOUND", async () => {
    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")
    const sA = await callerA.student.create({ fullName: "HS của A", grade: 3 })

    await expect(
      callerB.tuition.updatePayment({
        studentId: sA.id,
        year: 2026,
        month: 5,
        paidAmount: 100000,
        isFullPaid: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
