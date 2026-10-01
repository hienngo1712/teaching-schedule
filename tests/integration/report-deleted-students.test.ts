import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

// Ngày 1 tháng VN hiện tại: Tổng quan chỉ xem tháng này.
function thisMonth() {
  const v = new Date(Date.now() + 7 * 3600_000)
  const y = v.getUTCFullYear()
  const m = v.getUTCMonth() + 1
  return { y, m, day: `${y}-${String(m).padStart(2, "0")}-01` }
}

describe("Tiền của HS đã xoá vẫn tính (spec R8)", () => {
  beforeEach(clean)
  afterEach(() => {
    vi.useRealTimers()
  })

  it("Báo cáo + Tổng quan giữ nguyên sau khi xoá (và sau khi dọn) HS đã nghỉ hết nợ", async () => {
    const { y, m, day } = thisMonth()
    vi.setSystemTime(new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)))
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Doanh thu", grade: 7, tuitionFee: 150_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: day, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: y, month: m, amount: 150_000, paidAt: day, method: "cash" })

    const sumBefore = await caller.report.monthlySummary({ year: y, month: m })
    const dashBefore = await caller.report.dashboard()
    expect(sumBefore).toMatchObject({ totalPaid: 150_000, totalRevenue: 150_000, totalStudents: 1 })

    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })

    const sumAfter = await caller.report.monthlySummary({ year: y, month: m })
    const dashAfter = await caller.report.dashboard()
    expect(sumAfter).toMatchObject({
      totalPaid: sumBefore.totalPaid,
      totalRevenue: sumBefore.totalRevenue,
      expectedRevenue: sumBefore.expectedRevenue,
      totalStudents: sumBefore.totalStudents,
      totalOutstanding: sumBefore.totalOutstanding,
    })
    expect(dashAfter).toMatchObject({
      totalPaidMonth: dashBefore.totalPaidMonth,
      totalRevenueMonth: dashBefore.totalRevenueMonth,
      attendanceRate: dashBefore.attendanceRate,
    })
    // HS đang học giảm 1 vì HS đã nghỉ + xoá.
    expect(dashAfter.totalStudents).toBe(dashBefore.totalStudents - 1)
  })

  it("Báo cáo THÁNG CŨ giữ nguyên sau khi dọn vĩnh viễn HS (spec U U31)", async () => {
    const { y, m } = thisMonth()
    const py = m === 1 ? y - 1 : y
    const pm = m === 1 ? 12 : m - 1
    const pday = `${py}-${String(pm).padStart(2, "0")}-10`
    vi.setSystemTime(new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)))
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Tháng cũ", grade: 8, tuitionFee: 200_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: pday, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: py, month: pm, amount: 200_000, paidAt: pday, method: "cash" })
    const before = await caller.report.monthlySummary({ year: py, month: pm })
    expect(before).toMatchObject({ totalPaid: 200_000, totalRevenue: 200_000 })

    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })
    await caller.trash.purge({ type: "student" })

    const after = await caller.report.monthlySummary({ year: py, month: pm })
    expect(after).toMatchObject({
      totalPaid: before.totalPaid,
      totalRevenue: before.totalRevenue,
      expectedRevenue: before.expectedRevenue,
      totalStudents: before.totalStudents,
    })
    const purged = await db.student.findFirstOrThrow({ where: { id: st.id, isDeleted: true } })
    expect(purged.fullName).toBe("Học sinh đã xoá")
  })

  it("lọc theo khối vẫn tính HS đã xoá của khối đó", async () => {
    const { y, m, day } = thisMonth()
    vi.setSystemTime(new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)))
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Khối", grade: 8, tuitionFee: 90_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: day, startTime: "05:00", endTime: "06:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.payment.create({ studentId: st.id, year: y, month: m, amount: 90_000, paidAt: day, method: "cash" })
    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })
    expect(await caller.report.monthlySummary({ year: y, month: m, grade: 8 })).toMatchObject({ totalPaid: 90_000, totalRevenue: 90_000, totalStudents: 1 })
  })

  it("HS nhập nhầm bị xoá khi còn trong ca sắp tới (chưa điểm danh) → không tính vào dự kiến / số HS", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS Trùng", grade: 5, tuitionFee: 120_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    await caller.session.create({ sessionDate: "2031-04-07", startTime: "08:00", endTime: "09:00", subjectId, studentIds: [st.id] })
    expect(await caller.report.monthlySummary({ year: 2031, month: 4 })).toMatchObject({ expectedRevenue: 120_000, totalStudents: 1 })
    await caller.student.delete({ id: st.id })
    expect(await caller.report.monthlySummary({ year: 2031, month: 4 })).toMatchObject({ expectedRevenue: 0, totalStudents: 0 })
  })
})
