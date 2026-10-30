import { monthKey, type BillingMode } from "@/lib/billing"
import { vnDateParts } from "@/lib/utils"
import { getTuitionBadgeStatus, type TuitionBadgeStatus, type TuitionStatusInput } from "@/lib/tuition-status"

export type DisplayRow = {
  previousBalance: number
  totalExpected: number
  totalAmountDue: number
  paidAmount: number
  isFullPaid: boolean
  billingMode: BillingMode
  inProgress: boolean
}

export const NOTICE_OVERDUE_DAYS = 7

type SessionEndInput = { sessionDate: Date; endTime: Date; status: string; isDeleted: boolean }

// Mốc kết thúc ca cuối (bỏ ca huỷ/đã xoá). sessionDate lưu 0h UTC của ngày VN, endTime lưu giờ VN
// trên ngày 1970-01-01 UTC → ghép lại rồi trừ 7h ra mốc UTC thật.
export function lastSessionEnd(sessions: SessionEndInput[]): Date | null {
  let last: number | null = null
  for (const s of sessions) {
    if (s.isDeleted || s.status === "cancelled") continue
    const end = s.sessionDate.getTime() + (s.endTime.getTime() % 86_400_000) - 7 * 60 * 60 * 1000
    if (last === null || end > last) last = end
  }
  return last === null ? null : new Date(last)
}

// Tháng hiện tại xong ngay khi ca cuối của HS trong tháng kết thúc (spec AS); chưa có ca thì đang học tới hết tháng.
export function isInProgressMonth(year: number, month: number, lastEnd: Date | null, now: Date = new Date()): boolean {
  const t = vnDateParts(now)
  const key = monthKey(year, month)
  const cur = monthKey(t.year, t.month)
  if (key !== cur) return key > cur
  return lastEnd === null || now < lastEnd
}

// Tháng đang học của HS theo buổi chỉ là tạm tính: chưa cộng vào số phải đóng (spec Y D9).
export function isProvisional(row: Pick<DisplayRow, "inProgress" | "billingMode">): boolean {
  return row.inProgress && row.billingMode === "per_session"
}

export function rowStatusInput(row: DisplayRow): TuitionStatusInput {
  return isProvisional(row)
    ? {
        ...row,
        totalAmountDue: row.previousBalance,
        totalExpected: 0,
        paidAmount: Math.min(row.previousBalance, row.paidAmount),
      }
    : row
}

export function dueNow(row: DisplayRow): number {
  if (row.isFullPaid) return 0
  const s = rowStatusInput(row)
  return Math.max(0, s.totalAmountDue - row.paidAmount)
}

export function getRowStatus(row: DisplayRow): TuitionBadgeStatus {
  const status = getTuitionBadgeStatus(rowStatusInput(row))
  return (status === "no_sessions" || (status === "unpaid" && row.previousBalance <= 0)) && isProvisional(row)
    ? "in_progress"
    : status
}

export function noticeAgeDays(sentAt: Date | string, now: Date = new Date()): number {
  const a = vnDateParts(new Date(sentAt))
  const b = vnDateParts(now)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}
