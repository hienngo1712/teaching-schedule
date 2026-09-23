import { describe, it, expect, beforeAll } from "vitest"
import { getAuthedCaller } from "../helpers/trpc"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

describe("Report Router", () => {
  let caller: Caller
  let student: Awaited<ReturnType<Caller["student"]["create"]>>
  let subject: Awaited<ReturnType<Caller["subject"]["list"]>>[number]

  beforeAll(async () => {
    caller = await getAuthedCaller("teacher")
    
    // Create test data
    student = await caller.student.create({ fullName: "HS Báo Cáo", grade: 3 })
    const subjects = await caller.subject.list({})
    subject = subjects[0]

    // Create a session for this student
    await caller.session.create({
      sessionDate: "2026-05-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id]
    })
  })

  it("report.student → trả sessions + summary đúng", async () => {
    const report = await caller.report.student({
      studentId: student.id,
      year: 2026,
      month: 5
    })

    expect(report.student.fullName).toBe("HS Báo Cáo")
    // student chỉ còn field UI cần — không rò userId / thông tin phụ huynh ra client
    expect(Object.keys(report.student).sort()).toEqual(["fullName", "grade", "id", "level"])
    expect(report.sessions).toHaveLength(1)
    expect(report.summary.total).toBe(1)
    expect(report.summary.pending).toBe(1) // Default is pending
    expect(report.summary.rate).toBe(0)
  })

  it("summary: total, present, absent, late, rate tính đúng", async () => {
    // 1. Update attendance to present
    const sessions = await caller.session.getMonth({ year: 2026, month: 5, studentName: student.fullName })
    const sessionId = sessions[0].id

    await caller.attendance.update({
      sessionId,
      attendances: [{ studentId: student.id, attendance: "present", note: "Tốt" }]
    })

    // 2. Add another session (absent)
    await caller.session.create({
      sessionDate: "2026-05-12",
      startTime: "10:00",
      endTime: "11:30",
      subjectId: subject.id,
      studentIds: [student.id]
    })
    
    const sessionsAll = await caller.session.getMonth({ year: 2026, month: 5, studentName: student.fullName })
    const session2Id = sessionsAll.find((s) => s.startTime === "10:00")!.id

    await caller.attendance.update({
      sessionId: session2Id,
      attendances: [{ studentId: student.id, attendance: "absent" }]
    })

    const report = await caller.report.student({
      studentId: student.id,
      year: 2026,
      month: 5
    })

    expect(report.summary.total).toBe(2)
    expect(report.summary.present).toBe(1)
    expect(report.summary.absent).toBe(1)
    expect(report.summary.rate).toBe(50)
  })

  it("report.monthlySummary → trả tổng hợp", async () => {
    const summary = await caller.report.monthlySummary({
      year: 2026,
      month: 5
    })

    expect(summary.totalSessions).toBeGreaterThanOrEqual(2)
    expect(summary.totalStudents).toBeGreaterThanOrEqual(1)
    expect(summary.overallAttendanceRate).toBeGreaterThanOrEqual(0)
  })

  it("report.student id không tồn tại → NOT_FOUND", async () => {
    await expect(
      caller.report.student({ studentId: 99999, year: 2026, month: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("report.student → summary.expectedRevenue tính tổng tất cả fee không lọc attendance", async () => {
    const studentFee = await caller.student.create({
      fullName: "HS Fee Kỳ Vọng",
      grade: 7,
      tuitionFee: 50000,
    })

    const sess1 = await caller.session.create({
      sessionDate: "2026-05-15",
      startTime: "14:00",
      endTime: "15:30",
      subjectId: subject.id,
      studentIds: [studentFee.id],
    })

    const sess2 = await caller.session.create({
      sessionDate: "2026-05-17",
      startTime: "14:00",
      endTime: "15:30",
      subjectId: subject.id,
      studentIds: [studentFee.id],
    })

    await caller.attendance.update({
      sessionId: sess1.id,
      attendances: [{ studentId: studentFee.id, attendance: "present" }],
    })
    await caller.attendance.update({
      sessionId: sess2.id,
      attendances: [{ studentId: studentFee.id, attendance: "absent" }],
    })

    const report = await caller.report.student({
      studentId: studentFee.id,
      year: 2026,
      month: 5,
    })

    expect(report.summary.totalRevenue).toBe(50000)
    expect(report.summary.expectedRevenue).toBe(100000)
  }, 15000)

  it("report.student → lọc khoảng tháng 5→7 gộp đủ buổi & tiền cả 3 tháng", async () => {
    const studentRange = await caller.student.create({
      fullName: "HS Khoảng Thời Gian",
      grade: 8,
      tuitionFee: 70000,
    })

    for (const date of ["2026-05-20", "2026-06-20", "2026-07-20"]) {
      const sess = await caller.session.create({
        sessionDate: date,
        startTime: "16:00",
        endTime: "17:30",
        subjectId: subject.id,
        studentIds: [studentRange.id],
      })
      await caller.attendance.update({
        sessionId: sess.id,
        attendances: [{ studentId: studentRange.id, attendance: "present" }],
      })
    }

    const report = await caller.report.student({
      studentId: studentRange.id,
      year: 2026,
      month: 5,
      toYear: 2026,
      toMonth: 7,
    })

    expect(report.summary.total).toBe(3)
    expect(report.summary.expectedRevenue).toBe(210000)
    expect(report.summary.totalRevenue).toBe(210000)
  }, 20000)

  it("report.monthlySummary → expectedRevenue >= totalRevenue khi có học sinh vắng", async () => {
    const summary = await caller.report.monthlySummary({
      year: 2026,
      month: 5,
      grade: 7,
    })

    expect(summary.expectedRevenue).toBeGreaterThanOrEqual(summary.totalRevenue)
    expect(summary.expectedRevenue).toBeGreaterThan(summary.totalRevenue)
    expect(summary.expectedRevenue).toBe(100000)
    expect(summary.totalRevenue).toBe(50000)
  })
})
