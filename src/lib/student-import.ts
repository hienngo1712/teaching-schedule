import { studentCreateSchema } from "@/lib/schemas/student"

// Tiêu đề cột luôn tiếng Việt bất kể ngôn ngữ giao diện: 1 mẫu, parser chỉ cần 1 bộ nhãn.
export const IMPORT_COLUMNS = [
  { label: "Họ tên*", field: "fullName" },
  { label: "Lớp*", field: "grade" },
  { label: "Tên phụ huynh", field: "parentName" },
  { label: "SĐT phụ huynh", field: "parentPhone" },
  { label: "Học phí", field: "tuitionFee" },
  { label: "Cách thu", field: "billingMode" },
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
  billingMode?: "per_session" | "monthly"
  monthlyFee?: number
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

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export type ImportHeaderLayout = {
  valid: boolean
  hasBillingColumn: boolean
  hasNotesColumn: boolean
}

export function parseImportHeader(cells: unknown[]): ImportHeaderLayout {
  const clean = (val: unknown) => stripDiacritics(cellToText(val)).replace(/\s*\*$/, "")
  if (
    clean(cells[0]) !== "ho ten" ||
    clean(cells[1]) !== "lop" ||
    clean(cells[2]) !== "ten phu huynh" ||
    clean(cells[3]) !== "sdt phu huynh"
  ) {
    return { valid: false, hasBillingColumn: false, hasNotesColumn: false }
  }
  const feeLabel = clean(cells[4])
  if (feeLabel !== "hoc phi" && feeLabel !== "hoc phi/buoi") {
    return { valid: false, hasBillingColumn: false, hasNotesColumn: false }
  }

  const col5 = clean(cells[5])
  const col6 = clean(cells[6])

  if (!col5) {
    if (col6) return { valid: false, hasBillingColumn: false, hasNotesColumn: false }
    return { valid: true, hasBillingColumn: false, hasNotesColumn: false }
  }

  if (col5 === "cach thu") {
    if (!col6) return { valid: true, hasBillingColumn: true, hasNotesColumn: false }
    if (col6 === "ghi chu") return { valid: true, hasBillingColumn: true, hasNotesColumn: true }
    return { valid: false, hasBillingColumn: false, hasNotesColumn: false }
  }

  if (col5 === "ghi chu") {
    if (col6) return { valid: false, hasBillingColumn: false, hasNotesColumn: false }
    return { valid: true, hasBillingColumn: false, hasNotesColumn: true }
  }

  return { valid: false, hasBillingColumn: false, hasNotesColumn: false }
}

export function isImportHeader(cells: unknown[]): boolean {
  return parseImportHeader(cells).valid
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
  // Ô số: chỉ nhận nguyên >=0, số âm/lẻ là lỗi (trước đây lọt qua rồi ghi thẳng vào DB).
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 ? raw : NaN
  const text = cellToText(raw)
  if (!text) return 0
  // Bỏ khoảng trắng + hậu tố tiền tệ, rồi chỉ nhận số nguyên hoặc số có nhóm nghìn (.,): "150k", "1,5 triệu" v.v phải lỗi, không đoán mò.
  const cleaned = text.replace(/\s+/g, "").toLowerCase().replace(/(đ|₫|vnd)$/, "")
  if (!/^\d{1,3}([.,]\d{3})+$|^\d+$/.test(cleaned)) return NaN
  return Number(cleaned.replace(/[.,]/g, ""))
}

function parseBillingMode(raw: unknown): { mode: "per_session" | "monthly"; error: boolean } {
  const text = stripDiacritics(cellToText(raw))
  if (!text || text === "buoi") return { mode: "per_session", error: false }
  if (text === "thang") return { mode: "monthly", error: false }
  return { mode: "per_session", error: true }
}

function optionalText(raw: unknown): string | undefined {
  return cellToText(raw) || undefined
}

export function parseImportRows(
  rows: { rowNumber: number; cells: unknown[] }[],
  options?: { hasBillingColumn?: boolean }
): ParsedImportRow[] {
  const result: ParsedImportRow[] = []
  for (const { rowNumber, cells } of rows) {
    if (cells.every((c) => cellToText(c) === "")) continue

    const hasBilling = options?.hasBillingColumn ?? (cells.length >= 7)
    const fee = parseFee(cells[4])
    const { mode: billingMode, error: billingError } = hasBilling
      ? parseBillingMode(cells[5])
      : { mode: "per_session" as const, error: false }

    const isMonthly = billingMode === "monthly"
    const feeIsNaN = Number.isNaN(fee)

    const input: ImportRowInput = {
      fullName: cellToText(cells[0]).normalize("NFC"),
      grade: parseGrade(cells[1]),
      parentName: optionalText(cells[2]),
      parentPhone: parsePhone(cells[3]),
      tuitionFee: isMonthly ? (feeIsNaN ? NaN : 0) : fee,
      billingMode,
      monthlyFee: isMonthly ? (feeIsNaN ? NaN : fee) : 0,
      notes: optionalText(hasBilling ? cells[6] : cells[5]),
    }

    const check = studentCreateSchema.safeParse(input)
    const errors: ImportField[] = []
    if (billingError) {
      errors.push("billingMode")
    }
    if (!check.success) {
      for (const c of IMPORT_COLUMNS) {
        if (c.field === "billingMode" && billingError) continue
        if (check.error.issues.some((i) => i.path[0] === c.field)) {
          errors.push(c.field)
        }
      }
    }
    const sortedErrors = IMPORT_COLUMNS.map((c) => c.field).filter((f) => errors.includes(f))
    result.push({ rowNumber, input, errors: sortedErrors })
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
