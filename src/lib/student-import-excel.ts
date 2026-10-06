import type { Row } from "exceljs"
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  mapImportColumnsByName,
  parseImportHeader,
  parseImportRows,
  remapImportCells,
  type ParsedImportRow,
} from "@/lib/student-import"

export type ImportReadError = "file" | "size" | "template" | "empty" | "too_many"
export type ImportReadResult =
  | { ok: true; rows: ParsedImportRow[]; missingFee: boolean }
  | { ok: false; error: ImportReadError }

const HEADER_BG = "FFCCFBF1" // cùng màu headerBg của useExcelExport

const GUIDE_ROWS = [
  ["Cột", "Bắt buộc", "Cách điền", "Ví dụ"],
  ["Họ tên", "Có", "2 đến 100 ký tự", "Nguyễn Văn An"],
  ["Lớp", "Có", "Số từ 1 đến 12 (ghi \"Lớp 5\" cũng được)", "5"],
  ["Tên phụ huynh", "Không", "Tối đa 100 ký tự", "Chị Hoa"],
  ["SĐT phụ huynh", "Không", "Bắt đầu bằng 0 hoặc +84", "0912345678"],
  ["Học phí", "Không", "Số tiền VND, bỏ trống là 0", "150000"],
  ["Cách thu", "Không", "buổi hoặc tháng, bỏ trống là buổi", "tháng"],
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

  // File Google có thể nhiều hơn 7 cột (Dấu thời gian, câu hỏi thầy cô tự thêm).
  const width = Math.max(sheet.columnCount, IMPORT_COLUMNS.length)
  const readCells = (row: Row) => Array.from({ length: width }, (_, i) => row.getCell(i + 1).value)
  const header = readCells(sheet.getRow(1))
  const headerLayout = parseImportHeader(header)
  const byName = headerLayout.valid ? null : mapImportColumnsByName(header)
  if (!headerLayout.valid && !byName) return { ok: false, error: "template" }

  const raw: { rowNumber: number; cells: unknown[] }[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return
    const cells = readCells(row)
    raw.push({ rowNumber, cells: byName ? remapImportCells(cells, byName) : cells.slice(0, IMPORT_COLUMNS.length) })
  })
  const rows = parseImportRows(raw, { hasBillingColumn: byName ? true : headerLayout.hasBillingColumn })
  if (rows.length === 0) return { ok: false, error: "empty" }
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: "too_many" }
  return { ok: true, rows, missingFee: byName !== null && byName.tuitionFee === undefined }
}
