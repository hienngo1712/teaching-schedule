/**
 * Nguồn sự thật DUY NHẤT cho trạng thái học phí hiển thị của một học sinh trong
 * một tháng. Trước đây logic này được chép ở hai nơi (trang Học phí và thẻ tóm
 * tắt trong Báo cáo) và đã trôi khỏi nhau: bản ở Báo cáo thiếu nhánh "đã trả đủ
 * tổng nợ nhưng GV chưa tick tất toán", nên cùng một HS hiện "Đóng đủ" ở màn này
 * và "Đóng một phần" ở màn kia.
 *
 * Thứ tự nhánh là CÓ Ý và không được đảo:
 *  - overpaid trước fully_paid: trả dư là một trạng thái riêng cần thấy rõ.
 *  - settled_waived trước fully_paid: đã tất toán nhưng tiền thực đóng chưa đủ
 *    nghĩa là MIỄN/GIẢM — gọi là "đóng đủ" thì danh sách nói dối.
 */
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
  // Nợ âm (trả dư từ tháng trước) không phải là "phải đóng" → kẹp về 0.
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
