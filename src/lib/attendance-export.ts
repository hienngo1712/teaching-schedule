// Xuất Excel Chuyên cần (spec AN §3): bảng tháng hoặc năm học, dựng thuần để test.
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import type { RouterOutputs } from "@/lib/trpc"

type MonthData = RouterOutputs["attendanceReport"]["month"]
type YearData = RouterOutputs["attendanceReport"]["schoolYear"]
type Tr = (key: string) => string

const pct = (rate: number | null) => (rate === null ? "" : `${String(rate).replace(".", ",")}%`)

export function attendanceMonthTable(data: MonthData, t: Tr): { header: string[]; rows: (string | number)[][] } {
  return {
    header: [t("stt"), t("student"), t("grade"), t("att_present"), t("att_late"), t("att_absent"), t("att_col_ratio"), t("att_col_rate")],
    rows: data.students.map((s, i) => [i + 1, s.fullName, s.grade, s.present, s.late, s.absent, `${s.present}/${s.recorded}`, pct(s.rate)]),
  }
}

export function attendanceYearTable(data: YearData, t: Tr): { header: string[]; rows: (string | number)[][] } {
  return {
    header: [t("stt"), t("student"), t("grade"), ...data.months.map((m) => `T${m.month}/${m.year}`), t("att_year_rate")],
    rows: data.students.map((s, i) => [i + 1, s.fullName, s.grade, ...s.months.map((m) => pct(m.rate)), pct(s.rate)]),
  }
}

export async function exportAttendanceExcel(table: { header: string[]; rows: (string | number)[][] }, title: string, filename: string, sheetName: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.addRow([title]).font = { bold: true, size: 14 }
  sheet.addRow([])
  sheet.addRow(table.header).font = { bold: true }
  table.rows.forEach((r) => sheet.addRow(r))
  sheet.columns.forEach((c, i) => (c.width = i === 1 ? 26 : i === 0 ? 6 : 11))
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `${filename}.xlsx`)
}
