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
 * Đóng nhầm tiền / nhầm tháng phải HỦY được: reset về 0 và bỏ tất toán thì nợ
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

  it("hủy thanh toán (về 0, bỏ tất toán) làm nợ hiện lại trong chính tháng đó", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: true,
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
    })

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].paidAmount).toBe(0)
    expect(july.items[0].isFullPaid).toBe(false)
    expect(july.items[0].totalAmountDue).toBe(500000)
  }, 20000)

  it("hủy thanh toán trả lại nợ cho tháng sau (không bị tất toán nuốt mất)", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: true,
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
    })

    const aug = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })
    expect(aug.items[0].previousBalance).toBe(500000)
  }, 20000)

  it("ghi vết dòng audit vào notes khi hủy, giữ nguyên ghi chú của user", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: false,
      notes: "Mẹ chuyển khoản",
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
      notes: "Mẹ chuyển khoản",
    })

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].notes).toContain("Mẹ chuyển khoản")
    expect(july.items[0].notes).toContain("Hủy ghi nhận thanh toán: 500.000 đ → 0 đ")
  }, 20000)

  it("KHÔNG ghi vết ở lần ghi nhận đầu tiên", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: false,
      notes: "Tiền mặt",
    })

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].notes).toBe("Tiền mặt")
  }, 20000)

  it("chuyển tiền đóng nhầm từ tháng 7 sang tháng 8 cho ra số dư đúng ở cả hai tháng", async () => {
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
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 400000, isFullPaid: false,
    })
    // Hủy ở tháng 7, ghi lại vào tháng 8
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 8, paidAmount: 400000, isFullPaid: false,
    })

    const julyView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    const augView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })

    expect(julyView.items[0].paidAmount).toBe(0)
    expect(augView.items[0].previousBalance).toBe(500000) // nợ tháng 7 vẫn còn nguyên
    expect(augView.items[0].totalAmountDue).toBe(900000)  // 500k nợ + 400k tháng 8
    expect(augView.items[0].paidAmount).toBe(400000)
  }, 20000)
})
