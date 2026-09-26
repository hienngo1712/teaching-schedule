import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { crc16Ccitt } from "@/lib/vietqr"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>
type Attendance = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS]

const BANK = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}
const MAY = { year: 2026, month: 5 }

let nextHour = 7

async function cleanup() {
  // Payment trỏ tới MonthlyTuition → xoá trước.
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({
    data: { bankBin: null, bankAccountNumber: null, bankAccountName: null },
  })
}

async function createStudent(caller: Caller, fullName = "Trần Thị Bé") {
  return caller.student.create({ fullName, grade: 5, tuitionFee: 100000 })
}

// Mỗi ca 1 khung giờ riêng để không vướng kiểm tra trùng giờ.
async function addSession(
  caller: Caller,
  studentId: number,
  date: string,
  attendance: Attendance,
  fee = 100000
) {
  const [subject] = await caller.subject.list({})
  const h = String(nextHour++).padStart(2, "0")
  const s = await caller.session.create({
    sessionDate: date,
    startTime: `${h}:00`,
    endTime: `${h}:45`,
    subjectId: subject.id,
  })
  await caller.session.addStudents({ sessionId: s.id, studentIds: [studentId] })
  await caller.attendance.update({
    sessionId: s.id,
    attendances: [{ studentId, attendance, fee }],
  })
  return s
}

async function pay(
  caller: Caller,
  studentId: number,
  month: number,
  amount: number,
  paidAt: string,
  method: "cash" | "transfer" = "cash"
) {
  await caller.payment.create({ studentId, year: 2026, month, amount, paidAt, method })
}

describe("tuition.getNotice", () => {
  beforeEach(async () => {
    await cleanup()
    nextHour = 7
  })

  it("✓ ngày có mặt: gồm có mặt + muộn, bỏ vắng và ca huỷ, sắp theo ngày; số khớp getMonthlyStatusReadOnly", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-11", ATTENDANCE_STATUS.LATE, 120000)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-08", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-06", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-13", ATTENDANCE_STATUS.ABSENT)
    const cancelled = await addSession(caller, st.id, "2026-05-15", ATTENDANCE_STATUS.PRESENT)
    await db.teachingSession.update({ where: { id: cancelled.id }, data: { status: "cancelled" } })

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.presentDates).toEqual([
      { date: "2026-05-04", fee: 100000 },
      { date: "2026-05-06", fee: 100000 },
      { date: "2026-05-08", fee: 100000 },
      { date: "2026-05-11", fee: 120000 },
    ])
    expect(n.presentDates.reduce((s, d) => s + d.fee, 0)).toBe(n.currentMonthFee)

    const {
      items: [status],
    } = await caller.tuition.getMonthlyStatusReadOnly({ ...MAY, studentId: st.id, limit: 1 })
    expect(n).toMatchObject({
      studentId: st.id,
      fullName: status.fullName,
      grade: status.grade,
      year: 2026,
      month: 5,
      presentSessions: status.presentSessions,
      currentMonthFee: status.totalExpected,
      previousBalance: status.previousBalance,
      totalAmountDue: status.totalAmountDue,
      paidAmount: status.paidAmount,
      isFullPaid: status.isFullPaid,
    })
    expect(n.presentSessions).toBe(4)
    expect(n.teacherName).toBe("Giáo viên Test")
  })

  it("✓ nợ tháng trước + 2 lần thu → previousBalance, payments, paidAmount, remaining", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-04-20", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 50000, "2026-05-10", "cash")
    await pay(caller, st.id, 5, 30000, "2026-05-20", "transfer")

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.previousBalance).toBe(100000)
    expect(n.totalAmountDue).toBe(200000)
    expect(n.paidAmount).toBe(80000)
    expect(n.remaining).toBe(120000)
    expect(n.overpaid).toBe(0)
    // Phiếu sắp payments tăng dần theo paidAt (khác listPayments/sheet chi tiết, vẫn desc).
    expect(n.payments.map((p) => [p.paidAt, p.method, p.amount])).toEqual([
      ["2026-05-10", "cash", 50000],
      ["2026-05-20", "transfer", 30000],
    ])
  })

  it("✓ chưa cài ngân hàng → không QR; cài rồi → QR đúng số còn lại + CRC", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)

    const before = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(before.remaining).toBe(100000)
    expect(before.bankConfigured).toBe(false)
    expect(before.qr).toBeNull()

    await caller.settings.updateBankAccount(BANK)
    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.bankConfigured).toBe(true)
    expect(n.qr).toMatchObject({
      bankShortName: "Vietcombank",
      accountNumber: BANK.bankAccountNumber,
      accountName: BANK.bankAccountName,
      amount: 100000,
      content: "HP T5 Tran Thi Be",
    })
    const payload = n.qr!.payload
    expect(payload).toContain("0006970436" + "0113" + BANK.bankAccountNumber)
    expect(payload).toContain("5406100000")
    expect(payload.slice(-4)).toBe(crc16Ccitt(payload.slice(0, -4)))
  })

  it("✓ trả đủ → remaining 0, không QR", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 100000, "2026-05-10")

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ remaining: 0, overpaid: 0, qr: null, bankConfigured: true })
  })

  it("✓ trả dư → overpaid đúng, không QR", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 150000, "2026-05-10")

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ remaining: 0, overpaid: 50000, qr: null })
  })

  it("✓ tất toán khi còn thiếu → remaining 0, không QR, không trả dư", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 40000, "2026-05-10")
    await caller.tuition.updateSettlement({ studentId: st.id, ...MAY, isFullPaid: true, notes: null })

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ isFullPaid: true, remaining: 0, overpaid: 0, qr: null })
    expect(n.totalAmountDue).toBeGreaterThan(n.paidAmount)
  })

  it("✓ dư tháng trước lớn hơn học phí tháng (tổng âm) → remaining 0, overpaid 0, không QR", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-04-20", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 4, 250000, "2026-04-25")
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.previousBalance).toBe(-150000)
    expect(n.totalAmountDue).toBe(-50000)
    expect(n).toMatchObject({ remaining: 0, overpaid: 0, qr: null })
  })

  it("✓ tháng không có buổi nào nhưng còn nợ cũ → vẫn có phiếu, QR = nợ cũ", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-04-20", ATTENDANCE_STATUS.PRESENT)

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.presentDates).toEqual([])
    expect(n.presentSessions).toBe(0)
    expect(n.remaining).toBe(100000)
    expect(n.qr?.amount).toBe(100000)
  })

  it("✓ BIN đã lưu không còn trong VN_BANKS → coi như chưa cài", async () => {
    const caller = await getAuthedCaller()
    await db.user.update({
      where: { username: "teacher" },
      data: { bankBin: "999999", bankAccountNumber: "123456", bankAccountName: "A" },
    })
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ bankConfigured: false, qr: null, remaining: 100000 })
  })

  it("✓ chỉ đọc: tháng chưa từng mở → không tạo MonthlyTuition", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-03-10", ATTENDANCE_STATUS.PRESENT)
    expect(await db.monthlyTuition.count({ where: { studentId: st.id } })).toBe(0)

    const n = await caller.tuition.getNotice({ studentId: st.id, year: 2026, month: 3 })
    expect(n.currentMonthFee).toBe(100000)
    expect(await db.monthlyTuition.count({ where: { studentId: st.id } })).toBe(0)
  })

  it("✗ HS của user khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const caller2 = await getAuthedCaller("teacher2")
    const st = await createStudent(caller)
    await expect(
      caller2.tuition.getNotice({ studentId: st.id, ...MAY })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
