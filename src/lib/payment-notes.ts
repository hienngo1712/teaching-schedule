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
