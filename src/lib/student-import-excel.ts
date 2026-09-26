import type { Row } from "exceljs"
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  isImportHeader,
  parseImportRows,
  type ParsedImportRow,
} from "@/lib/student-import"

export type ImportReadError = "file" | "size" | "template" | "empty" | "too_many"
export type ImportReadResult = { ok: true; rows: ParsedImportRow[] } | { ok: false; error: ImportReadError }

const HEADER_BG = "FFE0E7FF" // cùng màu headerBg của useExcelExport

const GUIDE_ROWS = [
  ["Cột", "Bắt buộc", "Cách điền", "Ví dụ"],
  ["Họ tên", "Có", "2 đến 100 ký tự", "Nguyễn Văn An"],
  ["Lớp", "Có", "Số từ 1 đến 12 (ghi \"Lớp 5\" cũng được)", "5"],
  ["Tên phụ huynh", "Không", "Tối đa 100 ký tự", "Chị Hoa"],
  ["SĐT phụ huynh", "Không", "Bắt đầu bằng 0 hoặc +84", "0912345678"],
  ["Học phí/buổi", "Không", "Số tiền VND, bỏ trống là 0", "150000"],
  ["Ghi chú", "Không", "Tối đa 1000 ký tự", "Yếu phần hình học"],
]

// exceljs ~1MB: nạp động để trang Học sinh không phải tải khi chưa dùng tới.
async function loadExcelJS() {
  return (await import("exceljs")).default
}

export async function buildImportTemplate(): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()

  const sheet = wb.addWorksheet("Hoc sinh")
  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.label, width: 22 }))
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } }
  })
  // Cột SĐT dạng text để Excel không nuốt số 0 đầu.
  sheet.getColumn(4).numFmt = "@"

  const guide = wb.addWorksheet("Huong dan")
  guide.addRows(GUIDE_ROWS)
  guide.getRow(1).font = { bold: true }
  for (let i = 1; i <= 4; i++) guide.getColumn(i).width = 28

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

export async function readImportWorkbook(data: ArrayBuffer): Promise<ImportReadResult> {
  if (data.byteLength > MAX_IMPORT_FILE_BYTES) return { ok: false, error: "size" }

  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  try {
    // Kiểu khai `Buffer` của exceljs thực chất = ArrayBuffer (JSZip bên trong không cần Node Buffer).
    await wb.xlsx.load(data)
  } catch {
    return { ok: false, error: "file" }
  }
  const sheet = wb.worksheets[0]
  if (!sheet) return { ok: false, error: "file" }

  const readCells = (row: Row) => IMPORT_COLUMNS.map((_, i) => row.getCell(i + 1).value)
  if (!isImportHeader(readCells(sheet.getRow(1)))) return { ok: false, error: "template" }

  const raw: { rowNumber: number; cells: unknown[] }[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) raw.push({ rowNumber, cells: readCells(row) })
  })
  const rows = parseImportRows(raw)
  if (rows.length === 0) return { ok: false, error: "empty" }
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: "too_many" }
  return { ok: true, rows }
}
