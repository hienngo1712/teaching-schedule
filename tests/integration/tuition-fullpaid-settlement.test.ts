import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

// "Đã đóng đủ" (isFullPaid) = ĐÃ TẤT TOÁN tháng đó: không carry nợ dương sang
// tháng sau (GV có thể miễn/giảm phần còn lại). Tín dụng (trả dư) VẪN carry.
async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("Tuition — isFullPaid tất toán carry-over", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("isFullPaid (paidAmount thiếu) tháng 5 → tháng 6 KHÔNG còn nợ", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS A", grade: 3, tuitionFee: 100000 })

    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s5.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }],
    })

    // GV tick "đã đóng đủ" nhưng không gõ số tiền (paidAmount = 0)
    await caller.tuition.updatePayment({
      studentId: st.id, year: 2026, month: 5, paidAmount: 0, isFullPaid: true,
    })

    const june = await caller.tuition.getMonthlyStatus({ year: 2026, month: 6, studentId: st.id })
    expect(june.items[0].previousBalance).toBe(0)
    expect(june.items[0].totalAmountDue).toBe(0)

    const summary = await caller.report.monthlySummary({ year: 2026, month: 6 })
    expect(summary.totalOutstanding).toBe(0)
  }, 30_000)

  it("isFullPaid + trả dư (credit) → tín dụng VẪN carry sang tháng sau", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Credit", grade: 3, tuitionFee: 100000 })

    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s5.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }],
    })
    // Trả dư 150k cho phí 100k, đánh dấu đủ → credit 50k
    await caller.tuition.updatePayment({
      studentId: st.id, year: 2026, month: 5, paidAmount: 150000, isFullPaid: true,
    })

    const june = await caller.tuition.getMonthlyStatus({ year: 2026, month: 6, studentId: st.id })
    expect(june.items[0].previousBalance).toBe(-50000) // credit carry
  }, 30_000)

  it("CHƯA tick đủ + đóng thiếu → nợ VẪN carry (không đổi hành vi)", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Thiếu", grade: 3, tuitionFee: 100000 })

    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s5.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }],
    })
    await caller.tuition.updatePayment({
      studentId: st.id, year: 2026, month: 5, paidAmount: 30000, isFullPaid: false,
    })

    const june = await caller.tuition.getMonthlyStatus({ year: 2026, month: 6, studentId: st.id })
    expect(june.items[0].previousBalance).toBe(70000) // 100k - 30k còn nợ
  }, 30_000)

  it("CHỮA LÀNH: snapshot tháng 6 đã lưu sai previousBalance → đọc lại tự sửa", async () => {
    const caller = await getAuthedCaller()
    const subjectId = (await caller.subject.list({}))[0].id
    const st = await caller.student.create({ fullName: "HS Heal", grade: 3, tuitionFee: 100000 })

    const s5 = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s5.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 100000 }],
    })
    await caller.tuition.updatePayment({
      studentId: st.id, year: 2026, month: 5, paidAmount: 0, isFullPaid: true,
    })

    // Mô phỏng snapshot tháng 6 ghi sai trước khi vá (previousBalance=100k đông cứng)
    await db.monthlyTuition.create({
      data: {
        studentId: st.id, year: 2026, month: 6,
        totalSessions: 0, presentSessions: 0, currentMonthFee: 0,
        previousBalance: 100000, totalAmountDue: 100000, paidAmount: 0, isFullPaid: false,
      },
    })

    const june = await caller.tuition.getMonthlyStatus({ year: 2026, month: 6, studentId: st.id })
    expect(june.items[0].previousBalance).toBe(0) // tự chữa lành từ prevSnapshot
    expect(june.items[0].totalAmountDue).toBe(0)
  }, 30_000)
})
