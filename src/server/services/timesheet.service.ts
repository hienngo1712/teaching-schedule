// Bảng công + thu nhập nơi dạy tính theo ca/giờ (spec AM §3).

export type RateUnit = "session" | "hour"
export type Rate = { unit: RateUnit; amount: number }
export type RateChange = { fromKey: number; unit: string; amount: number }
export type SessionKind = "done" | "upcoming" | "cancelled"
export type IncomeStatus = "none" | "unpaid" | "partial" | "paid"

// Giờ của ca = phút / 60, làm tròn 2 chữ số. Giờ kết thúc ≤ giờ bắt đầu (dữ liệu lạ) → 0, không âm.
export function sessionHours(start: Date, end: Date): number {
  const minutes = (end.getTime() - start.getTime()) / 60000
  if (minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

// todayKey = "YYYY-MM-DD" theo ngày VN. Ca hôm nay (chưa huỷ) tính là đã dạy.
export function classifySession(s: { status: string; sessionDate: Date }, todayKey: string): SessionKind {
  if (s.status === "cancelled") return "cancelled"
  return s.sessionDate.toISOString().slice(0, 10) <= todayKey ? "done" : "upcoming"
}

// Đơn giá có hiệu lực tại tháng `key` (fromKey theo tháng như PlaceBillingChange). amount 0 = chưa có đơn giá.
export function resolveRate(changes: RateChange[], key: number): Rate | null {
  let matched: RateChange | null = null
  for (const c of changes) {
    if (c.fromKey <= key && (!matched || c.fromKey > matched.fromKey)) matched = c
  }
  if (!matched || matched.amount <= 0) return null
  return { unit: matched.unit === "hour" ? "hour" : "session", amount: matched.amount }
}

export function computeIncome({ doneCount, doneHours, rate }: { doneCount: number; doneHours: number; rate: Rate | null }): number | null {
  if (!rate) return null
  return rate.unit === "session" ? doneCount * rate.amount : Math.round(doneHours * rate.amount)
}

// Nhận dư vẫn là "paid" (phần dư hiện ở UI). Có giá nhưng dự kiến 0 và chưa nhận → "unpaid".
export function incomeStatus(expected: number | null, received: number): IncomeStatus {
  if (expected === null) return "none"
  if (received <= 0) return "unpaid"
  return received >= expected ? "paid" : "partial"
}
