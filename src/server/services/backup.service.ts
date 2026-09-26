import ExcelJS from "exceljs"
import type { PrismaClient } from "@prisma/client"
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { formatDayOfWeek, formatTime } from "@/lib/utils"
import type { PAYMENT_METHODS } from "@/lib/schemas/payment"

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

const SESSION_STATUS_LABEL: Record<string, string> = { scheduled: "Đã lên lịch", cancelled: "Đã hủy" }
// Gắn kiểu theo PAYMENT_METHODS của B: B thêm hình thức mới thì tsc báo ở đây.
const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
}
const UPGRADE_TRIGGER_LABEL: Record<string, string> = { auto: "Tự động", manual: "Thủ công" }

function label(map: Readonly<Record<string, string>>, value: string): string {
  return map[value] ?? value
}

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
  const [user, students, subjects, sessions, attendances, tuitions, payments, upgradeLogs] = await Promise.all([
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
    db.teachingSession.findMany({
      where: { userId },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }, { id: "asc" }],
      select: {
        id: true, sessionDate: true, startTime: true, endTime: true, subjectId: true, title: true,
        status: true, cancelReason: true, cancelledAt: true, makeupOfId: true, notes: true, createdAt: true,
        subject: { select: { name: true } },
        _count: { select: { sessionStudents: true } },
      },
    }),
    db.sessionStudent.findMany({
      where: { session: { userId } },
      orderBy: [{ session: { sessionDate: "asc" } }, { session: { startTime: "asc" } }, { id: "asc" }],
      select: {
        id: true, sessionId: true, studentId: true, grade: true, attendance: true, fee: true, note: true,
        session: { select: { sessionDate: true } },
        student: { select: { fullName: true } },
      },
    }),
    db.monthlyTuition.findMany({
      where: { student: { userId } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { studentId: "asc" }],
      select: {
        id: true, studentId: true, year: true, month: true, totalSessions: true, presentSessions: true,
        previousBalance: true, currentMonthFee: true, totalAmountDue: true, paidAmount: true,
        isFullPaid: true, notes: true, updatedAt: true,
        student: { select: { fullName: true } },
      },
    }),
    db.payment.findMany({
      where: { monthlyTuition: { student: { userId } } },
      orderBy: [{ paidAt: "asc" }, { id: "asc" }],
      select: {
        id: true, monthlyTuitionId: true, amount: true, paidAt: true, method: true, note: true,
        createdAt: true, updatedAt: true,
        monthlyTuition: {
          select: { studentId: true, year: true, month: true, student: { select: { fullName: true } } },
        },
      },
    }),
    db.classUpgradeLog.findMany({
      where: { userId },
      orderBy: { year: "asc" },
      select: {
        id: true, year: true, executedAt: true, trigger: true, upgradedCount: true, deactivatedCount: true,
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

  counts.push(["Ca dạy", addDataSheet(wb, "Ca dạy", sessions, [
    { header: "ID", width: 8, value: (s) => s.id },
    // @db.Date đã là 00:00 UTC đúng ngày → không cộng 7 giờ.
    { header: "Ngày", width: 12, kind: "date", value: (s) => s.sessionDate },
    { header: "Thứ", width: 6, value: (s) => formatDayOfWeek(s.sessionDate) },
    { header: "Bắt đầu", width: 9, value: (s) => formatTime(s.startTime) },
    { header: "Kết thúc", width: 9, value: (s) => formatTime(s.endTime) },
    { header: "ID môn", width: 8, value: (s) => s.subjectId },
    { header: "Môn", width: 18, value: (s) => s.subject.name },
    { header: "Tiêu đề", width: 20, value: (s) => s.title },
    { header: "Trạng thái", width: 13, value: (s) => label(SESSION_STATUS_LABEL, s.status) },
    { header: "Lý do hủy", width: 22, value: (s) => s.cancelReason },
    { header: "Thời điểm hủy", width: 17, kind: "datetime", value: (s) => vnTime(s.cancelledAt) },
    { header: "Bù cho ca (ID)", width: 13, value: (s) => s.makeupOfId },
    { header: "Số học sinh", width: 11, value: (s) => s._count.sessionStudents },
    { header: "Ghi chú", width: 30, value: (s) => s.notes },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (s) => vnTime(s.createdAt) },
  ])])

  counts.push(["Điểm danh", addDataSheet(wb, "Điểm danh", attendances, [
    { header: "ID", width: 8, value: (a) => a.id },
    { header: "ID ca", width: 8, value: (a) => a.sessionId },
    { header: "Ngày ca", width: 12, kind: "date", value: (a) => a.session.sessionDate },
    { header: "ID học sinh", width: 11, value: (a) => a.studentId },
    { header: "Học sinh", width: 26, value: (a) => a.student.fullName },
    { header: "Lớp lúc học", width: 11, value: (a) => a.grade },
    { header: "Điểm danh", width: 15, value: (a) => label(ATTENDANCE_LABEL, a.attendance) },
    { header: "Học phí buổi", width: 13, kind: "money", value: (a) => a.fee },
    { header: "Ghi chú", width: 30, value: (a) => a.note },
  ])])

  counts.push(["Học phí tháng", addDataSheet(wb, "Học phí tháng", tuitions, [
    { header: "ID", width: 8, value: (t) => t.id },
    { header: "ID học sinh", width: 11, value: (t) => t.studentId },
    { header: "Học sinh", width: 26, value: (t) => t.student.fullName },
    { header: "Năm", width: 7, value: (t) => t.year },
    { header: "Tháng", width: 7, value: (t) => t.month },
    { header: "Tổng buổi", width: 10, value: (t) => t.totalSessions },
    { header: "Buổi có mặt", width: 11, value: (t) => t.presentSessions },
    { header: "Nợ trước", width: 13, kind: "money", value: (t) => t.previousBalance },
    { header: "Học phí tháng", width: 13, kind: "money", value: (t) => t.currentMonthFee },
    { header: "Tổng phải đóng", width: 14, kind: "money", value: (t) => t.totalAmountDue },
    { header: "Đã trả", width: 13, kind: "money", value: (t) => t.paidAmount },
    { header: "Đã tất toán", width: 11, value: (t) => yesNo(t.isFullPaid) },
    { header: "Ghi chú", width: 30, value: (t) => t.notes },
    { header: "Cập nhật lần cuối", width: 17, kind: "datetime", value: (t) => vnTime(t.updatedAt) },
  ])])

  counts.push(["Lần thu", addDataSheet(wb, "Lần thu", payments, [
    { header: "ID", width: 8, value: (p) => p.id },
    { header: "ID học phí tháng", width: 15, value: (p) => p.monthlyTuitionId },
    { header: "ID học sinh", width: 11, value: (p) => p.monthlyTuition.studentId },
    { header: "Học sinh", width: 26, value: (p) => p.monthlyTuition.student.fullName },
    { header: "Năm", width: 7, value: (p) => p.monthlyTuition.year },
    { header: "Tháng", width: 7, value: (p) => p.monthlyTuition.month },
    { header: "Ngày thu", width: 12, kind: "date", value: (p) => p.paidAt },
    { header: "Số tiền", width: 13, kind: "money", value: (p) => p.amount },
    { header: "Hình thức", width: 13, value: (p) => label(PAYMENT_METHOD_LABEL, p.method) },
    { header: "Ghi chú", width: 30, value: (p) => p.note },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (p) => vnTime(p.createdAt) },
    { header: "Cập nhật lần cuối", width: 17, kind: "datetime", value: (p) => vnTime(p.updatedAt) },
  ])])

  counts.push(["Lịch sử lên lớp", addDataSheet(wb, "Lịch sử lên lớp", upgradeLogs, [
    { header: "ID", width: 8, value: (l) => l.id },
    { header: "Năm học", width: 9, value: (l) => l.year },
    { header: "Thời điểm chạy", width: 17, kind: "datetime", value: (l) => vnTime(l.executedAt) },
    { header: "Cách chạy", width: 11, value: (l) => label(UPGRADE_TRIGGER_LABEL, l.trigger) },
    { header: "Số HS lên lớp", width: 13, value: (l) => l.upgradedCount },
    { header: "Số HS cho nghỉ", width: 14, value: (l) => l.deactivatedCount },
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
