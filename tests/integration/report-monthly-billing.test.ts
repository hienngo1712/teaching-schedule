import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
}

describe("Báo cáo & Tổng quan theo cách thu (spec T)", () => {
  beforeEach(clean)
  afterEach(() => {
    vi.useRealTimers()
  })

  it("1. HS A theo buổi (2 có mặt, 1 pending) + HS B trọn tháng 400k (1 vắng, 1 pending) -> expected 550k, revenue 500k", async () => {
    const caller = await getAuthedCaller()
    const stA = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS A Buổi",
      grade: 5,
      tuitionFee: 50_000,
    })
    const stB = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS B Tháng",
      grade: 5,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // HS A: 3 ca tháng 3 (2 có mặt, 1 pending)
    const sa1 = await caller.session.create({ sessionDate: "2026-03-02", startTime: "08:00", endTime: "09:00", subjectId, studentIds: [stA.id] })
    const sa2 = await caller.session.create({ sessionDate: "2026-03-09", startTime: "08:00", endTime: "09:00", subjectId, studentIds: [stA.id] })
    await caller.session.create({ sessionDate: "2026-03-16", startTime: "08:00", endTime: "09:00", subjectId, studentIds: [stA.id] })
    await caller.attendance.update({ sessionId: sa1.id, attendances: [{ studentId: stA.id, attendance: "present" }] })
    await caller.attendance.update({ sessionId: sa2.id, attendances: [{ studentId: stA.id, attendance: "present" }] })

    // HS B: 2 ca tháng 3 (1 vắng, 1 pending)
    const sb1 = await caller.session.create({ sessionDate: "2026-03-05", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })
    await caller.session.create({ sessionDate: "2026-03-12", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })
    await caller.attendance.update({ sessionId: sb1.id, attendances: [{ studentId: stB.id, attendance: "absent" }] })

    const summary = await caller.report.monthlySummary({ year: 2026, month: 3 })
    // expected = (50k * 3) + 400k = 550k
    // earned = (50k * 2) + 400k (vì B đã có buổi điểm danh absent) = 500k
    expect(summary.expectedRevenue).toBe(550_000)
    expect(summary.totalRevenue).toBe(500_000)
    expect(summary.totalStudents).toBe(2)
  })

  it("2. HS B trọn tháng chỉ có ca chưa điểm danh (pending) -> expected 400k, revenue 0", async () => {
    const caller = await getAuthedCaller()
    const stB = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS B Chỉ Pending",
      grade: 6,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    await caller.session.create({ sessionDate: "2026-04-05", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })

    const summary = await caller.report.monthlySummary({ year: 2026, month: 4 })
    expect(summary.expectedRevenue).toBe(400_000)
    expect(summary.totalRevenue).toBe(0)
  })

  it("3. Báo cáo khoảng 2 tháng: B có ca cả 2 tháng -> expected 800k (400k x 2)", async () => {
    const caller = await getAuthedCaller()
    const stB = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS B Hai Tháng",
      grade: 7,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    await caller.session.create({ sessionDate: "2026-03-05", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })
    await caller.session.create({ sessionDate: "2026-04-05", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })

    const summary = await caller.report.monthlySummary({
      year: 2026,
      month: 3,
      toYear: 2026,
      toMonth: 4,
    })
    expect(summary.expectedRevenue).toBe(800_000)
  })

  it("4. Lọc theo khối: B học lớp 5 -> lọc khối 5 có 400k, lọc khối 6 là 0", async () => {
    const caller = await getAuthedCaller()
    const stB = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS B Khối 5",
      grade: 5,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s = await caller.session.create({ sessionDate: "2026-03-05", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: stB.id, attendance: "present" }] })

    const summaryGrade5 = await caller.report.monthlySummary({ year: 2026, month: 3, grade: 5 })
    expect(summaryGrade5.expectedRevenue).toBe(400_000)
    expect(summaryGrade5.totalRevenue).toBe(400_000)

    const summaryGrade6 = await caller.report.monthlySummary({ year: 2026, month: 3, grade: 6 })
    expect(summaryGrade6.expectedRevenue).toBe(0)
    expect(summaryGrade6.totalRevenue).toBe(0)
  })

  it("5. dashboard() tháng hiện tại tính đúng doanh thu HS trọn tháng", async () => {
    const { year, month } = vnDateParts()
    vi.setSystemTime(new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)))

    const caller = await getAuthedCaller()
    const dayStr = `${year}-${String(month).padStart(2, "0")}-10`

    const stB = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS B Dashboard",
      grade: 8,
      billingMode: "monthly",
      monthlyFee: 500_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s = await caller.session.create({ sessionDate: dayStr, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [stB.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: stB.id, attendance: "present" }] })

    const dash = await caller.report.dashboard()
    expect(dash.expectedRevenueMonth).toBe(500_000)
    expect(dash.totalRevenueMonth).toBe(500_000)
  })

  it("6. studentReport của HS trọn tháng: expected 400k, revenue 400k khi đã có buổi điểm danh", async () => {
    const caller = await getAuthedCaller()
    const stB = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS B Báo Cáo Riêng",
      grade: 9,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s = await caller.session.create({ sessionDate: "2026-03-05", startTime: "14:00", endTime: "15:00", subjectId, studentIds: [stB.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: stB.id, attendance: "present" }] })

    const rep = await caller.report.student({
      studentId: stB.id,
      year: 2026,
      month: 3,
    })
    expect(rep.summary.expectedRevenue).toBe(400_000)
    expect(rep.summary.totalRevenue).toBe(400_000)
  })
})
