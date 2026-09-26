import { studentCreateSchema } from "@/lib/schemas/student"

// Tiêu đề cột luôn tiếng Việt bất kể ngôn ngữ giao diện: 1 mẫu, parser chỉ cần 1 bộ nhãn.
export const IMPORT_COLUMNS = [
  { label: "Họ tên*", field: "fullName" },
  { label: "Lớp*", field: "grade" },
  { label: "Tên phụ huynh", field: "parentName" },
  { label: "SĐT phụ huynh", field: "parentPhone" },
  { label: "Học phí/buổi", field: "tuitionFee" },
  { label: "Ghi chú", field: "notes" },
] as const

export type ImportField = (typeof IMPORT_COLUMNS)[number]["field"]

export const MAX_IMPORT_ROWS = 500
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024

export type ImportRowInput = {
  fullName: string
  grade: number
  parentName?: string
  parentPhone?: string
  tuitionFee: number
  notes?: string
}

export type ParsedImportRow = { rowNumber: number; input: ImportRowInput; errors: ImportField[] }

export type ExistingMatch = { id: number; fullName: string; grade: number; isActive: boolean }

export type PreviewRow = ParsedImportRow & {
  status: "error" | "duplicate" | "ok"
  existing: ExistingMatch | null
  sameAsRow: number | null
}

// Excel trên Mac / copy từ web có thể ra NFD: nhìn giống nhưng so khác. Giữ dấu để không gộp nhầm "An" với "Ân".
function normalizeText(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi")
}

export function nameKey(fullName: string, grade: number): string {
  return `${grade}|${normalizeText(fullName)}`
}

export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown }
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim()
    if ("result" in v) return cellToText(v.result)
    if ("text" in v) return cellToText(v.text)
    return ""
  }
  return String(value).trim()
}

export function isImportHeader(cells: unknown[]): boolean {
  const clean = (s: string) => normalizeText(s).replace(/\s*\*$/, "")
  return IMPORT_COLUMNS.every((c, i) => clean(cellToText(cells[i])) === clean(c.label))
}

function parseGrade(raw: unknown): number {
  if (typeof raw === "number") return raw
  const m = normalizeText(cellToText(raw)).match(/^(?:lớp\s*)?(\d{1,2})$/)
  return m ? Number(m[1]) : NaN
}

function parsePhone(raw: unknown): string | undefined {
  const digits = cellToText(raw).replace(/[\s.\-]/g, "")
  if (!digits) return undefined
  // Ô SĐT kiểu số: Excel đã nuốt số 0 đầu.
  return typeof raw === "number" && digits.length === 9 ? `0${digits}` : digits
}

function parseFee(raw: unknown): number {
  if (typeof raw === "number") return raw
  const text = cellToText(raw)
  if (!text) return 0
  const digits = text.replace(/\D/g, "")
  // Chữ không có số nào → NaN để Zod báo lỗi ô, không âm thầm thành 0.
  return digits ? Number(digits) : NaN
}

function optionalText(raw: unknown): string | undefined {
  return cellToText(raw) || undefined
}

export function parseImportRows(rows: { rowNumber: number; cells: unknown[] }[]): ParsedImportRow[] {
  const result: ParsedImportRow[] = []
  for (const { rowNumber, cells } of rows) {
    if (IMPORT_COLUMNS.every((_, i) => cellToText(cells[i]) === "")) continue
    const input: ImportRowInput = {
      fullName: cellToText(cells[0]).normalize("NFC"),
      grade: parseGrade(cells[1]),
      parentName: optionalText(cells[2]),
      parentPhone: parsePhone(cells[3]),
      tuitionFee: parseFee(cells[4]),
      notes: optionalText(cells[5]),
    }
    const check = studentCreateSchema.safeParse(input)
    // Chỉ lấy tên field: message mặc định của Zod là tiếng Anh, UI tự dịch bằng key import_err_<field>.
    const errors = check.success
      ? []
      : IMPORT_COLUMNS.map((c) => c.field).filter((f) => check.error.issues.some((i) => i.path[0] === f))
    result.push({ rowNumber, input, errors })
  }
  return result
}

export function findInFileDuplicates(rows: ParsedImportRow[]): (number | null)[] {
  const first = new Map<string, number>()
  return rows.map((r) => {
    if (r.errors.length > 0) return null
    const key = nameKey(r.input.fullName, r.input.grade)
    const prev = first.get(key)
    if (prev !== undefined) return prev
    first.set(key, r.rowNumber)
    return null
  })
}

export function buildPreview(rows: ParsedImportRow[], matches: (ExistingMatch | null)[]): PreviewRow[] {
  const sameAs = findInFileDuplicates(rows)
  let validIndex = 0
  const all = rows.map((r, i): PreviewRow => {
    if (r.errors.length > 0) return { ...r, status: "error", existing: null, sameAsRow: null }
    const existing = matches[validIndex++] ?? null
    const sameAsRow = existing ? null : sameAs[i]
    const status = existing || sameAsRow !== null ? "duplicate" : "ok"
    return { ...r, status, existing, sameAsRow }
  })
  // Lỗi trước, rồi trùng, rồi hợp lệ: chỗ cần xử lý nằm trên cùng.
  return (["error", "duplicate", "ok"] as const).flatMap((s) => all.filter((r) => r.status === s))
}

export function toImportPayload(
  preview: PreviewRow[],
  allowed: ReadonlySet<number>
): (ImportRowInput & { allowDuplicate: boolean })[] {
  return preview
    .filter((r) => r.status === "ok" || (r.status === "duplicate" && allowed.has(r.rowNumber)))
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((r) => ({ ...r.input, allowDuplicate: r.status === "duplicate" }))
}
