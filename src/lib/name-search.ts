// Tên HS được mã hoá trong DB (spec O Q7) → mọi lọc/sắp theo tên chạy ở đây, sau khi giải mã.
const collator = new Intl.Collator("vi")

export function normalizeForSearch(s: string): string {
  return s.normalize("NFC").toLocaleLowerCase("vi")
}

// Giữ đúng hành vi ILIKE cũ: không phân biệt hoa thường, vẫn phân biệt dấu.
export function nameMatches(fullName: string, term: string | undefined): boolean {
  if (!term) return true
  return normalizeForSearch(fullName).includes(normalizeForSearch(term))
}

export function compareViName(a: string, b: string): number {
  return collator.compare(a, b)
}

export function byGradeThenName<T extends { grade: number; fullName: string; id: number }>(a: T, b: T): number {
  return a.grade - b.grade || compareViName(a.fullName, b.fullName) || a.id - b.id
}
