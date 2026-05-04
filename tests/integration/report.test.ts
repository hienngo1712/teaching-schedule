import { describe, it, expect, beforeAll } from "vitest"
import { getAuthedCaller } from "../helpers/trpc"

describe("Report Router", () => {
  let caller: any
  let student: any
  let subject: any

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
    const session2Id = sessionsAll.find((s: any) => s.startTime === "10:00").id

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
    expect(summary.byGrade).toHaveLength(9)
    expect(summary.byGrade.find((g: any) => g.grade === 3).sessionCount).toBeGreaterThanOrEqual(2)
  })

  it("report.student id không tồn tại → NOT_FOUND", async () => {
    await expect(
      caller.report.student({ studentId: 99999, year: 2026, month: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
