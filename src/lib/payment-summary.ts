import { vnDateParts } from "./utils"

export type PaymentSummaryLine = { kind: "remaining" | "overpaid" | "waived"; amount: number }

// Dòng dưới "Đã trả" trong sheet (spec B §6.2). Tổng phải đóng ≤ 0 là tín dụng, không tính trả dư.
export function paymentSummaryLine(m: {
  totalAmountDue: number
  paidAmount: number
  isFullPaid: boolean
}): PaymentSummaryLine {
  if (m.totalAmountDue > 0 && m.paidAmount > m.totalAmountDue) {
    return { kind: "overpaid", amount: m.paidAmount - m.totalAmountDue }
  }
  const remaining = Math.max(0, m.totalAmountDue - m.paidAmount)
  if (m.isFullPaid && remaining > 0) return { kind: "waived", amount: remaining }
  return { kind: "remaining", amount: remaining }
}

// Nút "Số còn lại": khi sửa, số cũ của chính lần đang sửa không tính là đã trả.
export function remainingToFill(totalAmountDue: number, paidAmount: number, editingAmount = 0): number {
  return Math.max(0, totalAmountDue - (paidAmount - editingAmount))
}

export function vnTodayIso(now: Date = new Date()): string {
  const { year, month, day } = vnDateParts(now)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
