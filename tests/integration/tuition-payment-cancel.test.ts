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
 * Đóng nhầm tiền / nhầm tháng phải HỦY được: xoá lần thu và bỏ tất toán thì nợ
 * phải hiện lại đúng ở tháng đó VÀ chuyển đúng sang tháng sau (không bị
 * Math.min(0, residual) của isFullPaid nuốt mất).
 */
describe("Hủy / sửa ghi nhận thanh toán học phí", () => {
  beforeEach(async () => {
    await cleanup()
  })

  async function seedJulyDebt(fee: number) {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const student = await caller.student.create({
      fullName: "HS Đóng Nhầm",
      grade: 5,
      tuitionFee: fee,
    })
    const s = await caller.session.create({
      sessionDate: "2026-07-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subjects[0].id,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee }],
    })
    return { caller, student }
  }

  async function payAndSettleThenCancel(fee: number) {
    const { caller, student } = await seedJulyDebt(fee)
    const key = { studentId: student.id, year: 2026, month: 7 }
    const p = await caller.payment.create({ ...key, amount: fee, paidAt: "2026-07-15", method: "cash" })
    await caller.tuition.updateSettlement({ ...key, isFullPaid: true })
    await caller.payment.delete({ id: p.id })
    await caller.tuition.updateSettlement({ ...key, isFullPaid: false })
    return { caller, student }
  }

  it("hủy thanh toán (xoá lần thu, bỏ tất toán) làm nợ hiện lại trong chính tháng đó", async () => {
    const { caller, student } = await payAndSettleThenCancel(500000)

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].paidAmount).toBe(0)
    expect(july.items[0].isFullPaid).toBe(false)
    expect(july.items[0].totalAmountDue).toBe(500000)
  }, 60_000)

  it("hủy thanh toán trả lại nợ cho tháng sau (không bị tất toán nuốt mất)", async () => {
    const { caller, student } = await payAndSettleThenCancel(500000)

    const aug = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })
    expect(aug.items[0].previousBalance).toBe(500000)
  }, 60_000)

  it("chuyển tiền đóng nhầm từ tháng 7 sang tháng 8 (xoá rồi thêm lại) cho ra số dư đúng ở cả hai tháng", async () => {
    const { caller, student } = await seedJulyDebt(500000)
    const subjects = await caller.subject.list({})
    const aug = await caller.session.create({
      sessionDate: "2026-08-10", startTime: "08:00", endTime: "09:30", subjectId: subjects[0].id,
    })
    await caller.session.addStudents({ sessionId: aug.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: aug.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 400000 }],
    })

    // Đóng nhầm vào tháng 7
    const wrong = await caller.payment.create({
      studentId: student.id, year: 2026, month: 7, amount: 400000, paidAt: "2026-08-12", method: "cash",
    })
    // Xoá ở tháng 7, thêm lại vào tháng 8
    await caller.payment.delete({ id: wrong.id })
    await caller.payment.create({
      studentId: student.id, year: 2026, month: 8, amount: 400000, paidAt: "2026-08-12", method: "cash",
    })

    const julyView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    const augView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })

    expect(julyView.items[0].paidAmount).toBe(0)
    expect(augView.items[0].previousBalance).toBe(500000) // nợ tháng 7 vẫn còn nguyên
    expect(augView.items[0].totalAmountDue).toBe(900000)  // 500k nợ + 400k tháng 8
    expect(augView.items[0].paidAmount).toBe(400000)
  }, 60_000)
})
