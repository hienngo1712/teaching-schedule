import ExcelJS from "exceljs"
import type { PrismaClient } from "@prisma/client"

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const HEADER_BG = "FFE0E7FF"

type Kind = "text" | "phone" | "money" | "date" | "datetime"
type CellValue = string | number | Date | null | undefined

interface Column<T> {
  header: string
  width: number
  kind?: Kind
  value: (row: T) => CellValue
}

const NUM_FMT: Partial<Record<Kind, string>> = {
  phone: "@",
  money: "#,##0",
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
}

const NOTE_READONLY = "File chỉ để lưu trữ và đối chiếu. Ứng dụng không nhập lại file này."
const NOTE_TUITION = "Học phí tháng là số đã lưu; tháng chưa mở trang Học phí có thể chưa có dòng."

// exceljs đổi Date sang số serial theo UTC → phải cộng 7 giờ thì ô mới hiện đúng giờ VN.
function vnTime(d: Date | null): Date | null {
  return d ? new Date(d.getTime() + VN_OFFSET_MS) : null
}

function yesNo(b: boolean): string {
  return b ? "Có" : "Không"
}

export function backupFileName(now: Date): string {
  const vn = new Date(now.getTime() + VN_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, "0")
  const date = `${vn.getUTCFullYear()}-${p(vn.getUTCMonth() + 1)}-${p(vn.getUTCDate())}`
  return `SaoLuu_${date}_${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}.xlsx`
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } }
  })
}

function addDataSheet<T>(wb: ExcelJS.Workbook, name: string, rows: T[], columns: Column<T>[]): number {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width }))
  styleHeader(ws)
  for (const r of rows) {
    const row = ws.addRow(columns.map((c) => c.value(r) ?? null))
    columns.forEach((c, i) => {
      const fmt = c.kind && NUM_FMT[c.kind]
      if (fmt) row.getCell(i + 1).numFmt = fmt
    })
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return rows.length
}

export async function buildBackupWorkbook(
  db: PrismaClient,
  userId: number,
  now: Date
): Promise<ExcelJS.Workbook> {
  // Mọi truy vấn đều liệt kê cột: thêm cột nhạy cảm vào schema sau này không tự lọt ra file.
  const [user, students, subjects] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, fullName: true },
    }),
    db.student.findMany({
      where: { userId },
      orderBy: [{ grade: "asc" }, { fullName: "asc" }, { id: "asc" }],
      select: {
        id: true, fullName: true, grade: true, parentName: true, parentPhone: true,
        tuitionFee: true, isActive: true, notes: true, createdAt: true, updatedAt: true,
      },
    }),
    db.subject.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true, name: true, color: true, isDefault: true, isActive: true,
        sortOrder: true, createdAt: true,
      },
    }),
  ])

  const wb = new ExcelJS.Workbook()
  // Tạo trước để "Thông tin" đứng đầu; nội dung điền sau khi biết số dòng từng sheet.
  const info = wb.addWorksheet("Thông tin", { views: [{ state: "frozen", ySplit: 1 }] })
  const counts: [string, number][] = []

  counts.push(["Học sinh", addDataSheet(wb, "Học sinh", students, [
    { header: "ID", width: 8, value: (s) => s.id },
    { header: "Họ tên", width: 26, value: (s) => s.fullName },
    { header: "Lớp", width: 6, value: (s) => s.grade },
    { header: "Tên phụ huynh", width: 22, value: (s) => s.parentName },
    { header: "SĐT phụ huynh", width: 15, kind: "phone", value: (s) => s.parentPhone },
    { header: "Học phí/buổi", width: 14, kind: "money", value: (s) => s.tuitionFee },
    { header: "Đang học", width: 10, value: (s) => yesNo(s.isActive) },
    { header: "Ghi chú", width: 30, value: (s) => s.notes },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (s) => vnTime(s.createdAt) },
    { header: "Cập nhật lần cuối", width: 17, kind: "datetime", value: (s) => vnTime(s.updatedAt) },
  ])])

  counts.push(["Môn học", addDataSheet(wb, "Môn học", subjects, [
    { header: "ID", width: 8, value: (s) => s.id },
    { header: "Tên môn", width: 22, value: (s) => s.name },
    { header: "Màu (hex)", width: 11, value: (s) => s.color },
    { header: "Mặc định", width: 10, value: (s) => yesNo(s.isDefault) },
    { header: "Đang dạy", width: 10, value: (s) => yesNo(s.isActive) },
    { header: "Thứ tự", width: 8, value: (s) => s.sortOrder },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (s) => vnTime(s.createdAt) },
  ])])

  info.columns = [{ header: "Mục", width: 32 }, { header: "Giá trị", width: 80 }]
  styleHeader(info)
  info.addRow(["Tài khoản", user.username])
  info.addRow(["Họ tên", user.fullName ?? null])
  info.addRow(["Thời điểm xuất", vnTime(now)]).getCell(2).numFmt = NUM_FMT.datetime!
  for (const [name, n] of counts) info.addRow([`Số dòng: ${name}`, n])
  info.addRow(["Lưu ý", NOTE_READONLY])
  info.addRow(["Lưu ý", NOTE_TUITION])

  return wb
}
