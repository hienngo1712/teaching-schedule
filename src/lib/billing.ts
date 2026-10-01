import { ATTENDANCE_STATUS } from "@/lib/constants"

export type BillingMode = "per_session" | "monthly"
export type BillingChange = { fromKey: number; mode: BillingMode; monthlyFee: number }
export type Billing = { mode: BillingMode; monthlyFee: number }

export const PER_SESSION: Billing = { mode: "per_session", monthlyFee: 0 }

// Khóa tháng dạng số nguyên: year * 12 + month - 1
export function monthKey(year: number, month: number): number {
  return year * 12 + month - 1
}

// Tìm cách thu có hiệu lực tại tháng key (fromKey lớn nhất <= key); không có -> PER_SESSION
export function resolveBilling(changes: BillingChange[], key: number): Billing {
  let matched: BillingChange | null = null
  for (const c of changes) {
    if (c.fromKey <= key) {
      if (!matched || c.fromKey > matched.fromKey) {
        matched = c
      }
    }
  }
  if (!matched) return PER_SESSION
  return { mode: matched.mode, monthlyFee: matched.monthlyFee }
}

// Link của 1 học sinh trong 1 tháng (đã lọc ca sống, không huỷ)
export type MonthLink = { attendance: string; fee: number }

// Học phí 1 tháng: trọn tháng thu 1 lần khi có >= 1 ca (spec T2); theo buổi tính tổng có mặt/muộn
export function monthFee(billing: Billing, links: MonthLink[]): number {
  if (billing.mode === "monthly") {
    return links.length >= 1 ? billing.monthlyFee : 0
  }
  return links.reduce((sum, l) => {
    if (l.attendance === ATTENDANCE_STATUS.PRESENT || l.attendance === ATTENDANCE_STATUS.LATE) {
      return sum + l.fee
    }
    return sum
  }, 0)
}

// Doanh thu dự kiến và thực tế 1 tháng: trọn gói tính doanh thu khi có ít nhất 1 ca đã điểm danh
export function revenueForMonth(billing: Billing, links: MonthLink[]): { expected: number; earned: number } {
  if (billing.mode === "monthly") {
    if (links.length === 0) return { expected: 0, earned: 0 }
    const expected = billing.monthlyFee
    const hasAttended = links.some((l) => l.attendance !== ATTENDANCE_STATUS.PENDING)
    const earned = hasAttended ? billing.monthlyFee : 0
    return { expected, earned }
  }

  let expected = 0
  let earned = 0
  for (const l of links) {
    expected += l.fee
    if (l.attendance === ATTENDANCE_STATUS.PRESENT || l.attendance === ATTENDANCE_STATUS.LATE) {
      earned += l.fee
    }
  }
  return { expected, earned }
}
