/**
 * Đặt cùng một trạng thái điểm danh cho TẤT CẢ học sinh, trả về object MỚI và
 * giữ immutability: mỗi entry là một object mới, state cũ không bị mutate.
 * (Tránh lỗi sửa trực tiếp object con nằm trong state React.)
 */
export function setAllAttendance<T extends { attendance: string }>(
  state: Record<number, T>,
  status: T["attendance"]
): Record<number, T> {
  const next: Record<number, T> = {}
  for (const [key, value] of Object.entries(state)) {
    next[Number(key)] = { ...value, attendance: status }
  }
  return next
}
