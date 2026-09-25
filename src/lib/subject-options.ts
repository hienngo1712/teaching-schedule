export type SubjectOption = { id: number; name: string; color: string }

// Ô chọn môn chỉ lấy môn đang dạy; khi sửa ca có môn đã ẩn phải thêm môn đó để ô không trống.
export function withCurrentSubject(
  active: SubjectOption[],
  current?: SubjectOption
): (SubjectOption & { hidden: boolean })[] {
  const items = active.map((s) => ({ ...s, hidden: false }))
  if (current && !active.some((s) => s.id === current.id)) {
    items.push({ ...current, hidden: true })
  }
  return items
}
