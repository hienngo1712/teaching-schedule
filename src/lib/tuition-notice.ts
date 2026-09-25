import type { TuitionNoticeDTO } from "@/lib/types/models"

// Phí lưu theo từng buổi, có thể khác nhau → chỉ in 1 con số khi mọi buổi cùng phí (spec C S9).
export function noticeFeePerSession(dates: { fee: number }[]): number | null {
  if (dates.length === 0) return null
  const fee = dates[0].fee
  return dates.every((d) => d.fee === fee) ? fee : null
}

export type NoticePaymentState = "qr" | "none" | "settled" | "paid"

// Khối thanh toán cuối phiếu (spec C §6.3 mục 5). "none" = còn nợ nhưng chưa cài ngân hàng.
export function noticePaymentState(
  n: Pick<TuitionNoticeDTO, "remaining" | "qr" | "isFullPaid" | "totalAmountDue" | "paidAmount">
): NoticePaymentState {
  if (n.remaining > 0) return n.qr ? "qr" : "none"
  if (n.isFullPaid && n.totalAmountDue > n.paidAmount) return "settled"
  return "paid"
}
