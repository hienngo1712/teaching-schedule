import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { buildTransferContent, buildVietQrPayload } from "@/lib/vietqr"
import { findBank } from "@/lib/vn-banks"
import type { TuitionNoticeInput } from "@/lib/schemas/tuition"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { getMonthlyTuitionStatus } from "./tuition.service"
import { listPayments } from "./payment.service"
import { getBankAccount } from "./settings.service"

// Chỉ đọc: persist=false, không ghi MonthlyTuition/Payment.
export async function getTuitionNotice(
  db: PrismaClient,
  userId: number,
  { studentId, year, month }: TuitionNoticeInput
): Promise<TuitionNoticeDTO> {
  const { items } = await getMonthlyTuitionStatus(
    db,
    userId,
    { studentId, year, month, status: "all", page: 1, limit: 1 },
    false
  )
  const status = items[0]
  // Đã lọc theo userId → HS của user khác cũng rơi vào đây.
  if (!status) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy học sinh" })

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  const [attended, payments, bank, user] = await Promise.all([
    // Cùng điều kiện với currentAttendance trong getMonthlyTuitionStatus để tổng fee khớp.
    db.sessionStudent.findMany({
      where: {
        studentId,
        attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        session: { userId, sessionDate: { gte: startDate, lt: endDate }, status: { not: "cancelled" } },
      },
      select: { fee: true, session: { select: { sessionDate: true } } },
      orderBy: [{ session: { sessionDate: "asc" } }, { session: { startTime: "asc" } }],
    }),
    listPayments(db, userId, { studentId, year, month }),
    getBankAccount(db, userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true, username: true } }),
  ])

  const { totalAmountDue, paidAmount, isFullPaid } = status
  // Khớp sheet chi tiết của B và getMonthlyOutstanding (spec C S8).
  const remaining = isFullPaid ? 0 : Math.max(0, totalAmountDue - paidAmount)
  const surplus = paidAmount - Math.max(0, totalAmountDue)
  const overpaid = !isFullPaid && surplus > 0 ? surplus : 0

  const bankInfo = bank ? findBank(bank.bankBin) : undefined
  const content = buildTransferContent(status.fullName, month)
  const qr =
    bank && bankInfo && remaining > 0
      ? {
          payload: buildVietQrPayload({
            bin: bankInfo.bin,
            accountNumber: bank.bankAccountNumber,
            amount: remaining,
            content,
          }),
          bankShortName: bankInfo.shortName,
          accountNumber: bank.bankAccountNumber,
          accountName: bank.bankAccountName,
          amount: remaining,
          content,
        }
      : null

  return {
    studentId: status.studentId,
    fullName: status.fullName,
    grade: status.grade,
    year,
    month,
    presentSessions: status.presentSessions,
    currentMonthFee: status.totalExpected,
    previousBalance: status.previousBalance,
    totalAmountDue,
    paidAmount,
    isFullPaid,
    presentDates: attended.map((a) => ({
      date: a.session.sessionDate.toISOString().slice(0, 10),
      fee: a.fee,
    })),
    payments,
    remaining,
    overpaid,
    teacherName: user.fullName ?? user.username,
    // BIN không còn trong VN_BANKS → coi như chưa cài để không tạo QR sai ngân hàng.
    bankConfigured: Boolean(bankInfo),
    qr,
  }
}
