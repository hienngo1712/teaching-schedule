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

export function isInProgressMonth(year: number, month: number, now: Date = new Date()): boolean {
  const t = vnDateParts(now)
  return monthKey(year, month) >= monthKey(t.year, t.month)
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
