import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"
import { keyToYearMonth } from "@/lib/payment-allocation"
import { monthKey } from "@/lib/billing"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
}

describe("Tuition in-progress & provisional logic (spec Y Task 3)", () => {
  beforeEach(clean)

  it("tháng đang học, nợ cũ, tạm tính, QR, alerts", async () => {
    const caller = await getAuthedCaller("teacher")
    const { year: curY, month: curM } = vnDateParts()
    const curK = monthKey(curY, curM)
    const prevM = keyToYearMonth(curK - 1)
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // Cài đặt tài khoản ngân hàng để phiếu báo có QR
    await caller.settings.updateBankAccount({
      bankBin: "970436",
      bankAccountNumber: "0123456789",
      bankAccountName: "NGUYEN VAN A",
      consent: CONSENT_ACCEPTED,
    })

    // 1. HS theo buổi, nợ tháng trước 800k + tháng hiện tại 3 buổi có mặt
    const st1 = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Buoi InProgress",
      grade: 5,
      tuitionFee: 100_000,
    })

    // Tháng trước: 8 buổi 100k = 800k
    for (let day = 1; day <= 8; day++) {
      const d = `${prevM.year}-${String(prevM.month).padStart(2, "0")}-${String(day * 2).padStart(2, "0")}`
      const s = await caller.session.create({ sessionDate: d, startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st1.id] })
      await db.sessionStudent.updateMany({ where: { sessionId: s.id }, data: { attendance: "present", fee: 100_000 } })
    }

    // Đánh dấu đã gửi phiếu tháng trước để test alerts
    await caller.tuition.setNoticeSent({ studentId: st1.id, year: prevM.year, month: prevM.month, sent: true })

    // Tháng hiện tại: 3 buổi 100k = 300k
    for (let day = 1; day <= 3; day++) {
      const d = `${curY}-${String(curM).padStart(2, "0")}-${String(day * 2).padStart(2, "0")}`
      const s = await caller.session.create({ sessionDate: d, startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st1.id] })
      await db.sessionStudent.updateMany({ where: { sessionId: s.id }, data: { attendance: "present", fee: 100_000 } })
    }

    // 2. HS trọn tháng 400k không nợ
    const st2 = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS TronThang InProgress",
      grade: 6,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const sCur = await caller.session.create({
      sessionDate: `${curY}-${String(curM).padStart(2, "0")}-05`,
      startTime: "14:00",
      endTime: "15:30",
      subjectId,
      studentIds: [st2.id],
    })
    await db.sessionStudent.updateMany({ where: { sessionId: sCur.id }, data: { attendance: "present", fee: 0 } })

    // Kiểm tra getMonthlyStatus tháng hiện tại cho st1
    const stat1 = await caller.tuition.getMonthlyStatus({ year: curY, month: curM, studentId: st1.id })
    const it1 = stat1.items[0]
    expect(it1.inProgress).toBe(true)
    expect(it1.debtMonths).toBe(1)
    expect(it1.previousBalance).toBe(800_000)
    expect(it1.totalExpected).toBe(300_000)
    expect(it1.totalAmountDue).toBe(1_100_000)

    // Lọc status: "unpaid" có HS1
    const unp = await caller.tuition.getMonthlyStatus({ year: curY, month: curM, status: "unpaid" })
    expect(unp.items.some((i) => i.studentId === st1.id)).toBe(true)

    // Lọc status: "unpaid" cũng có HS2 (vì trọn tháng tính đủ ngay từ đầu tháng)
    expect(unp.items.some((i) => i.studentId === st2.id)).toBe(true)

    // QR của phiếu báo tháng hiện tại cho st1: chỉ thu 800k cần đóng ngay
    const not1 = await caller.tuition.getNotice({ studentId: st1.id, year: curY, month: curM })
    expect(not1.remaining).toBe(800_000)
    expect(not1.qr?.amount).toBe(800_000)
    expect(not1.inProgress).toBe(true)

    // Report alerts: có noticeSentAt của tháng trước
    const alerts = await caller.report.alerts()
    const alertSt1 = alerts.debts.find((d) => d.studentId === st1.id)
    expect(alertSt1).toBeDefined()
    expect(alertSt1?.noticeSentAt).toBeDefined()

    // Thu 800k cho st1 -> vào fully_paid
    await caller.payment.record({ studentId: st1.id, year: curY, month: curM, amount: 800_000 })
    const fullP = await caller.tuition.getMonthlyStatus({ year: curY, month: curM, status: "fully_paid" })
    expect(fullP.items.some((i) => i.studentId === st1.id)).toBe(true)
  })
})
