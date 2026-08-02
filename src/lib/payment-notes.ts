import { formatCurrency } from "./utils"

/**
 * Hợp nhất ghi chú "trả dư" tự động vào ghi chú do người dùng nhập một cách
 * idempotent: luôn GỠ auto-note đã chèn trước đó (theo đúng chuỗi, không phụ
 * thuộc ngôn ngữ) rồi mới chèn auto-note mới. Nhờ vậy:
 *  - Đổi ngôn ngữ không làm note bị nhân đôi.
 *  - Giảm số tiền xuống dưới mức nợ (không còn trả dư) sẽ gỡ note thừa.
 *  - Đổi số tiền dư sẽ cập nhật đúng note.
 *
 * @param rawNotes      Ghi chú hiện tại trong form (gồm cả auto-note cũ nếu có).
 * @param prevAutoNote  Auto-note đã chèn ở lần trước ("" nếu chưa chèn).
 * @param autoNote      Auto-note mới cần chèn ("" nếu không còn trả dư).
 */
export function mergeOverpaidNote(params: {
  rawNotes: string
  prevAutoNote: string
  autoNote: string
}): string {
  const { rawNotes, prevAutoNote, autoNote } = params

  let base = rawNotes
  if (prevAutoNote) {
    base = rawNotes
      .split("\n")
      .filter((line) => line !== prevAutoNote)
      .join("\n")
  }

  if (!autoNote) return base
  return base ? `${base}\n${autoNote}` : autoNote
}

/**
 * Ngày theo giờ VN (UTC+7) dạng dd/mm/yyyy. Không dùng giờ local của process vì
 * server chạy UTC (Vercel) — sẽ lệch ngày với giáo viên trước 07:00 sáng.
 */
export function formatVnDate(now: Date): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const day = String(vn.getUTCDate()).padStart(2, "0")
  const month = String(vn.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${vn.getUTCFullYear()}`
}

/**
 * Ghép một dòng ghi vết vào ghi chú khi thanh toán bị SỬA hoặc HỦY. Lần ghi nhận
 * đầu tiên (prevPaidAmount = 0, chưa tất toán) KHÔNG ghi vết — chỉ việc đính
 * chính mới cần dấu vết. Timestamp do server truyền vào để test tất định.
 */
export function buildPaymentAuditNote(params: {
  notes: string
  prevPaidAmount: number
  nextPaidAmount: number
  prevIsFullPaid: boolean
  nextIsFullPaid: boolean
  now: Date
}): string {
  const { notes, prevPaidAmount, nextPaidAmount, prevIsFullPaid, nextIsFullPaid, now } = params

  const parts: string[] = []

  if (prevPaidAmount > 0 && nextPaidAmount !== prevPaidAmount) {
    const label = nextPaidAmount === 0 ? "Hủy ghi nhận thanh toán" : "Sửa số tiền đã đóng"
    parts.push(`${label}: ${formatCurrency(prevPaidAmount)} → ${formatCurrency(nextPaidAmount)}`)
  }

  if (prevIsFullPaid && !nextIsFullPaid) {
    parts.push(parts.length > 0 ? "bỏ đánh dấu tất toán" : "Bỏ đánh dấu tất toán")
  }

  if (parts.length === 0) return notes

  const line = `[${formatVnDate(now)}] ${parts.join("; ")}`
  return notes ? `${notes}\n${line}` : line
}
