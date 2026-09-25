// title có thể là "" (form lưu chuỗi rỗng) — `??` không bắt được, phải dùng trim + ||.
export function getSessionLabel(session: {
  title: string | null
  subject: { name: string }
}): string {
  return session.title?.trim() || session.subject.name
}
