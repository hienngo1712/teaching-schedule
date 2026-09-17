// Nguồn sự thật duy nhất cho trạng thái học phí (badge + bộ lọc).
// Thứ tự nhánh trong getTuitionBadgeStatus là có ý, không đảo.
export type TuitionBadgeStatus =
  | "overpaid"
  | "settled_waived"
  | "fully_paid"
  | "paid_this_month"
  | "partial"
  | "unpaid"
  | "no_sessions"

export type TuitionStatusInput = {
  paidAmount: number
  isFullPaid: boolean
  totalExpected: number
  previousBalance: number
  totalAmountDue: number
}

export function getTuitionBadgeStatus(item: TuitionStatusInput): TuitionBadgeStatus {
  // Nợ âm (credit tháng trước) không phải "phải đóng" → kẹp về 0.
  const adjustedAmount = Math.max(0, item.totalAmountDue)

  if (item.paidAmount > adjustedAmount && adjustedAmount > 0) return "overpaid"
  if (item.isFullPaid && item.paidAmount < adjustedAmount) return "settled_waived"
  if (item.isFullPaid) return "fully_paid"
  if (item.paidAmount >= adjustedAmount && adjustedAmount > 0) return "fully_paid"
  if (
    item.paidAmount >= item.totalExpected &&
    item.totalExpected > 0 &&
    item.previousBalance > 0
  ) {
    return "paid_this_month"
  }
  if (item.paidAmount > 0) return "partial"
  if (adjustedAmount > 0) return "unpaid"
  return "no_sessions"
}

export type TuitionStatusFilter =
  | "all" | "fully_paid" | "paid_this_month" | "partial" | "unpaid"

// Bộ lọc suy ra từ badge, không chép lại điều kiện.
// 'fully_paid' cố ý gộp cả trả dư và miễn/giảm.
export function matchesTuitionStatusFilter(
  item: TuitionStatusInput,
  filter: TuitionStatusFilter | undefined
): boolean {
  if (!filter || filter === "all") return true

  const status = getTuitionBadgeStatus(item)
  switch (filter) {
    case "fully_paid":
      return status === "fully_paid" || status === "overpaid" || status === "settled_waived"
    case "paid_this_month":
      return status === "paid_this_month"
    case "partial":
      return status === "partial"
    case "unpaid":
      return status === "unpaid"
  }
}
