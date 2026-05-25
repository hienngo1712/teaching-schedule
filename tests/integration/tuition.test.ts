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

    expect(status.items).toHaveLength(1)
    expect(status.items[0].fullName).toBe("Nguyễn Văn An")
    expect(status.items[0].totalSessions).toBe(3)
    expect(status.items[0].presentSessions).toBe(2)
    expect(status.items[0].totalExpected).toBe(200000)
    expect(status.items[0].paidAmount).toBe(0)
    expect(status.items[0].isFullPaid).toBe(false)
  }, 30_000)

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
    expect(status.items[0].paidAmount).toBe(150000)
    expect(status.items[0].isFullPaid).toBe(false)
    expect(status.items[0].notes).toBe("Mới đóng một nửa")

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
    expect(updatedStatus.items[0].paidAmount).toBe(200000)
    expect(updatedStatus.items[0].isFullPaid).toBe(true)
    expect(updatedStatus.items[0].notes).toBe("Đã đóng đủ")
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

  it("✓ getMonthlyStatus với studentId → chỉ trả về đúng học sinh đó", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    // Tạo 2 học sinh
    const studentA = await caller.student.create({ fullName: "Trần Thị B", grade: 2, tuitionFee: 120000 })
    const studentB = await caller.student.create({ fullName: "Lê Văn C", grade: 4, tuitionFee: 80000 })

    // Tạo session tháng 5/2026 và assign cả 2
    const session = await caller.session.create({
      sessionDate: "2026-05-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    await caller.session.addStudents({ sessionId: session.id, studentIds: [studentA.id, studentB.id] })
    await caller.attendance.update({
      sessionId: session.id,
      attendances: [
        { studentId: studentA.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 120000 },
        { studentId: studentB.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 80000 },
      ],
    })

    // Query chỉ lấy studentA
    const result = await caller.tuition.getMonthlyStatus({
      year: 2026,
      month: 5,
      studentId: studentA.id,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].studentId).toBe(studentA.id)
    expect(result.items[0].fullName).toBe("Trần Thị B")
    expect(result.items[0].totalExpected).toBe(120000) // 1 buổi × 120,000
  }, 30_000)

  it("✓ getMonthlyStatus với studentId không có session trong tháng → totalExpected = 0", async () => {
    const caller = await getAuthedCaller()

    const student = await caller.student.create({ fullName: "Phạm Văn D", grade: 3, tuitionFee: 100000 })

    // Không tạo session nào cho tháng 5/2026
    const result = await caller.tuition.getMonthlyStatus({
      year: 2026,
      month: 5,
      studentId: student.id,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].studentId).toBe(student.id)
    expect(result.items[0].totalExpected).toBe(0)
    expect(result.items[0].previousBalance).toBe(0)
    expect(result.items[0].totalAmountDue).toBe(0)
  })

  it("✓ getMonthlyStatus với studentId có nợ tháng trước → previousBalance tính đúng", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({ fullName: "Ngô Thị E", grade: 5, tuitionFee: 150000 })

    // Tạo session tháng 4/2026 → có mặt → fee = 150,000
    const sessionApr = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: sessionApr.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: sessionApr.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 150000 }],
    })

    // getMonthlyStatus tháng 4 trước để tạo snapshot (paidAmount = 0)
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 4, studentId: student.id })

    // Query tháng 5 → previousBalance phải = 150,000
    const result = await caller.tuition.getMonthlyStatus({
      year: 2026,
      month: 5,
      studentId: student.id,
    })

    expect(result.items[0].previousBalance).toBe(150000)
    expect(result.items[0].totalAmountDue).toBe(150000) // chưa có session tháng 5
  }, 30_000)
})
