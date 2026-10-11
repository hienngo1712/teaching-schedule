// Bảng công xuất Excel/ảnh (spec AM §4.1): mặc định không kèm tiền; bật "Kèm số tiền" mới có cột tiền.
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import type { RouterOutputs } from "@/lib/trpc"
import { formatDayOfWeek } from "@/lib/utils"

export type TimesheetData = RouterOutputs["timesheet"]["month"]
export type TimesheetRow = TimesheetData["sessions"][number]
export type RateInfo = { unit: "session" | "hour"; amount: number }
// t của LanguageProvider nhận khoá có kiểu; ở đây ghép khoá động nên nhận string.
export type Tr = (key: string) => string

// Giờ hiển thị kiểu VN, bỏ số 0 thừa: 1.5 → "1,5", 3 → "3".
export function formatHours(h: number): string {
  return h.toLocaleString("vi-VN", { maximumFractionDigits: 2 })
}

// Tiền của 1 ca đã dạy theo đơn giá; ca chưa dạy / huỷ không có tiền.
export function sessionAmount(s: Pick<TimesheetRow, "kind" | "hours">, rate: RateInfo): number | null {
  if (s.kind !== "done") return null
  return rate.unit === "session" ? rate.amount : Math.round(s.hours * rate.amount)
}

export function kindLabel(s: Pick<TimesheetRow, "kind" | "isMakeup">, t: Tr): string {
  if (s.kind === "done" && s.isMakeup) return t("ts_kind_makeup")
  return t(`ts_kind_${s.kind}`)
}

// Bảng dùng chung cho Excel: tiêu đề + dòng + tổng. withMoney chỉ có tác dụng khi có đơn giá.
export function timesheetTable(
  sessions: TimesheetRow[],
  opts: { withMoney: boolean; rate: RateInfo | null },
  t: Tr
): { header: string[]; rows: (string | number)[][] } {
  const money = opts.withMoney && opts.rate !== null
  const header = [t("stt"), t("ts_col_date"), t("ts_col_time"), t("ts_col_subject"), t("ts_col_hours"), t("ts_col_present"), t("ts_col_status")]
  if (money) header.push(t("ts_col_amount"))
  const rows = sessions.map((s, i) => {
    const d = new Date(`${s.date}T00:00:00.000Z`)
    const row: (string | number)[] = [
      i + 1,
      `${formatDayOfWeek(d)} ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`,
      `${s.start}–${s.end}`,
      s.title ? `${s.subject} – ${s.title}` : s.subject,
      s.kind === "cancelled" ? "" : s.hours,
      s.kind === "done" ? `${s.presentCount}/${s.totalCount}` : "",
      s.cancelReason ? `${kindLabel(s, t)} · ${s.cancelReason}` : kindLabel(s, t),
    ]
    if (money) row.push(sessionAmount(s, opts.rate!) ?? "")
    return row
  })
  return { header, rows }
}

export async function exportTimesheetExcel(params: {
  data: TimesheetData
  title: string
  subtitle: string
  totalLine: string
  withMoney: boolean
  rate: RateInfo | null
  filename: string
  t: Tr
}) {
  const { header, rows } = timesheetTable(params.data.sessions, { withMoney: params.withMoney, rate: params.rate }, params.t)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(params.t("timesheet"))
  sheet.addRow([params.title]).font = { bold: true, size: 14 }
  sheet.addRow([params.subtitle])
  sheet.addRow([])
  sheet.addRow(header).font = { bold: true }
  rows.forEach((r) => sheet.addRow(r))
  sheet.addRow([])
  sheet.addRow([params.totalLine]).font = { bold: true }
  sheet.columns.forEach((c, i) => (c.width = [6, 12, 14, 26, 9, 11, 26, 14][i] ?? 12))
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `${params.filename}.xlsx`)
}
