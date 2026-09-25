import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { recordPayment } from "../helpers/payment"

// Nhóm B — sửa lỗi tính tài chính/báo cáo.
async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("Nhóm B — tài chính/báo cáo", () => {
  beforeEach(async () => {
    await cleanup()
  })

  // ── Write-in-read-path: dashboard/report KHÔNG được ghi snapshot ────
  it("✓ report.monthlySummary là READ-ONLY: không tạo/ghi snapshot MonthlyTuition", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS ReadOnly", grade: 3, tuitionFee: 100000 })
    const s = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })

    await caller.report.monthlySummary({ year: 2026, month: 5 })
    await caller.report.dashboard()

    const snap = await db.monthlyTuition.findFirst({ where: { studentId: st.id, year: 2026, month: 5 } })
    expect(snap).toBeNull() // đường đọc không được ghi DB
  }, 30_000)

  it("✓ tuition.getMonthlyStatus VẪN materialize snapshot (persist mặc định)", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Persist", grade: 3, tuitionFee: 100000 })
    const s = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })

    await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })

    const snap = await db.monthlyTuition.findFirst({ where: { studentId: st.id, year: 2026, month: 5 } })
    expect(snap).not.toBeNull()
  }, 30_000)

  // ── #8: toMonth không kèm toYear → revenue & paid phải cùng kỳ ──────
  it("✓ monthlySummary: toMonth không kèm toYear cho cùng kết quả với bản chỉ rõ toYear", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Range", grade: 3, tuitionFee: 100000 })

    const s4 = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s4.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 4, amount: 100000, isFullPaid: true })

    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s5.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 100000, isFullPaid: true })

    const implicit = await caller.report.monthlySummary({ year: 2026, month: 4, toMonth: 5 })
    const explicit = await caller.report.monthlySummary({ year: 2026, month: 4, toYear: 2026, toMonth: 5 })

    expect(implicit.totalSessions).toBe(explicit.totalSessions)
    expect(implicit.totalRevenue).toBe(explicit.totalRevenue)
    expect(implicit.totalPaid).toBe(explicit.totalPaid)
    // Cùng kỳ T4–T5: doanh thu = 200k, đã thu = 200k
    expect(implicit.totalRevenue).toBe(200000)
    expect(implicit.totalPaid).toBe(200000)
  }, 60_000)

  // ── #4: paidAmount gắn theo grade CỦA TỪNG THÁNG (HS đổi khối giữa kỳ) ─
  it("✓ monthlySummary theo grade: paidAmount không tính lẫn sang khối khác", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Đổi Khối", grade: 5, tuitionFee: 100000 })

    // Tháng 4: khối 5, thu 100k
    const s4 = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s4.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 4, amount: 100000, isFullPaid: true })

    // Đổi khối 5 → 6 (buổi T4 giữ snapshot khối 5)
    await caller.student.update({ id: st.id, data: { grade: 6 } })

    // Tháng 5: khối 6, thu 200k
    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s5.id, attendances: [{ studentId: st.id, attendance: "present", fee: 200000 }] })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 200000, isFullPaid: true })

    const grade5 = await caller.report.monthlySummary({ year: 2026, month: 4, toYear: 2026, toMonth: 5, grade: 5 })
    const grade6 = await caller.report.monthlySummary({ year: 2026, month: 4, toYear: 2026, toMonth: 5, grade: 6 })

    expect(grade5.totalPaid).toBe(100000) // chỉ tiền T4 (khối 5)
    expect(grade6.totalPaid).toBe(200000) // chỉ tiền T5 (khối 6)
  }, 60_000)

  // ── #3: filter 'partial' phải khớp badge client (credit/trả dư) ──────
  it("✓ filter partial: HS có credit, đã trả vượt nợ thực tế → KHÔNG nằm trong 'partial'", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Credit", grade: 3, tuitionFee: 100000 })

    // T4: phí 100k, trả dư 150k → credit 50k sang T5
    const s4 = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s4.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 4, amount: 150000, isFullPaid: true })

    // T5: phí 100k → nợ thực tế = -50k + 100k = 50k. Trả 60k → đã vượt nợ (overpaid)
    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({ sessionId: s5.id, attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }] })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 60000, isFullPaid: false })

    const all = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    const item = all.items.find((i) => i.studentId === st.id)
    expect(item).toBeDefined()
    expect(item!.previousBalance).toBe(-50000)
    expect(item!.totalAmountDue).toBe(50000)

    const partial = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5, status: "partial" })
    expect(partial.items.find((i) => i.studentId === st.id)).toBeUndefined()
  }, 60_000)
})
