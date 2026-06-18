import { useState } from "react"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { toast } from "sonner"
import { ATTENDANCE_LABEL, ATTENDANCE_STATUS, COLORS } from "@/lib/constants"
import { formatDate, formatDayOfWeek, removeVietnameseTones, formatCurrency } from "@/lib/utils"
import type { SessionDTO, StudentDTO } from "@/lib/types/models"

const toArgb = (hex: string) => `FF${hex.replace("#", "")}`
const EXCEL_COLORS = {
  primary: toArgb(COLORS.primary),
  present: toArgb(COLORS.present),
  absent: toArgb(COLORS.absent),
  late: toArgb(COLORS.late),
  pending: toArgb(COLORS.pending),
  headerBg: "FFE0E7FF",
  white: "FFFFFFFF",
} as const

export function useExcelExport() {
  const [isExporting, setIsExporting] = useState(false)

  // Chế độ 1: Lịch tháng dạng calendar grid
  const exportMonthlySchedule = async (
    sessions: SessionDTO[],
    year: number,
    month: number,
    teacherName: string
  ) => {
    setIsExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet(`Lịch tháng ${month}-${year}`)

      // Styles
      const titleStyle: Partial<ExcelJS.Style> = {
        font: { name: "Arial", size: 16, bold: true },
        alignment: { horizontal: "center" },
      }
      const headerStyle: Partial<ExcelJS.Style> = {
        font: { name: "Arial", size: 11, bold: true, color: { argb: EXCEL_COLORS.white } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.primary } },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      }

      // Title
      sheet.mergeCells("A1:H1")
      const titleCell = sheet.getCell("A1")
      titleCell.value = `LỊCH DẠY HỌC - THÁNG ${month}/${year}`
      titleCell.style = titleStyle

      sheet.mergeCells("A2:H2")
      const infoCell = sheet.getCell("A2")
      infoCell.value = `Giáo viên: ${teacherName} | Ngày xuất: ${formatDate(new Date())}`
      infoCell.alignment = { horizontal: "center" }

      // Grid logic - simplified for Excel
      const gridHeaderRow = sheet.getRow(4)
      gridHeaderRow.values = ["Thứ", "Ngày", "Lớp", "Giờ", "Môn", "Tiêu đề", "Học sinh", "Ghi chú"]
      gridHeaderRow.eachCell((cell) => {
        cell.style = headerStyle
      })
      
      sessions.forEach((s, i) => {
        const studentNames = s.students.map(st => st.fullName).join(", ")
        const grades = Array.from(new Set(s.students.map(st => st.grade))).join(", ")
        sheet.getRow(5 + i).values = [
          formatDayOfWeek(s.sessionDate),
          formatDate(s.sessionDate),
          grades,
          `${s.startTime}-${s.endTime}`,
          s.subject.name,
          s.title || "",
          studentNames,
          s.notes || ""
        ]
      })

      sheet.columns.forEach(col => col.width = 20)

      const buffer = await workbook.xlsx.writeBuffer()
      const filename = removeVietnameseTones(`LichThang_${month}_${year}`)
      saveAs(new Blob([buffer]), `${filename}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }

  // Chế độ 2: Lịch 1 học sinh
  const exportStudentSchedule = async (
    student: { id: number; fullName: string; grade: number },
    sessions: SessionDTO[],
    summary: { total: number; present: number; absent: number; late: number; rate: number },
    period: string,
    tuitionInfo?: {
      tuitionFeePerSession: number   // student.tuitionFee (mặc định/buổi)
      currentMonthFee: number        // TuitionStatusDTO.totalExpected
      previousBalance: number        // TuitionStatusDTO.previousBalance
      totalAmountDue: number         // TuitionStatusDTO.totalAmountDue
    }
  ) => {
    setIsExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet(student.fullName)

      // Row 1–3: merge A:G và center
      sheet.mergeCells("A1:G1")
      sheet.getCell("A1").value = "BÁO CÁO LỊCH HỌC CÁ NHÂN"
      sheet.getCell("A1").font = { size: 16, bold: true }
      sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }
      sheet.getRow(1).height = 28

      sheet.mergeCells("A2:G2")
      sheet.getCell("A2").value = `Học sinh: ${student.fullName} | Lớp: ${student.grade}`
      sheet.getCell("A2").alignment = { horizontal: "center" }

      sheet.mergeCells("A3:G3")
      sheet.getCell("A3").value = `Kỳ báo cáo: ${period} | Ngày xuất: ${formatDate(new Date())}`
      sheet.getCell("A3").alignment = { horizontal: "center" }

      // --- Tuition block (rows 5–9, only when tuitionInfo is provided) ---
      let headerRowIdx = 5 // default: no tuition block

      if (tuitionInfo) {
        headerRowIdx = 11 // shift attendance table down

        // Row 5: section title — merge A5:D5
        sheet.mergeCells("A5:D5")
        const tuitionTitleCell = sheet.getCell("A5")
        tuitionTitleCell.value = `─── HỌC PHÍ ${period.toUpperCase()} ───`
        tuitionTitleCell.font = { bold: true, size: 12 }

        // Row 6: Học phí/buổi — label A6:C6, value D6
        sheet.mergeCells("A6:C6")
        sheet.getCell("A6").value = "Học phí/buổi (mặc định)"
        sheet.getCell("D6").value = formatCurrency(tuitionInfo.tuitionFeePerSession)
        sheet.getCell("D6").alignment = { horizontal: "right" }

        // Row 7: Học phí tháng này — label A7:C7, value D7
        sheet.mergeCells("A7:C7")
        sheet.getCell("A7").value = "Học phí tháng này"
        sheet.getCell("D7").value = formatCurrency(tuitionInfo.currentMonthFee)
        sheet.getCell("D7").alignment = { horizontal: "right" }

        // Row 8: Nợ tháng trước — label A8:C8, value D8
        sheet.mergeCells("A8:C8")
        sheet.getCell("A8").value = "Nợ tháng trước"
        sheet.getCell("D8").value = formatCurrency(tuitionInfo.previousBalance)
        sheet.getCell("D8").alignment = { horizontal: "right" }
        if (tuitionInfo.previousBalance > 0) {
          sheet.getCell("D8").font = { color: { argb: EXCEL_COLORS.absent }, bold: true }
        }

        // Row 9: TỔNG CẦN ĐÓNG — label A9:C9 (yellow), value D9 (yellow)
        sheet.mergeCells("A9:C9")
        const totalLabelCell = sheet.getCell("A9")
        const totalValueCell = sheet.getCell("D9")
        totalLabelCell.value = "TỔNG CẦN ĐÓNG"
        totalLabelCell.font = { bold: true, size: 12 }
        totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } }
        totalValueCell.value = formatCurrency(tuitionInfo.totalAmountDue)
        totalValueCell.font = { bold: true, size: 12, color: { argb: "FF856404" } }
        totalValueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } }
        totalValueCell.alignment = { horizontal: "right" }
        // Row 10: intentionally blank — visual separator before attendance table
      }

      // --- Attendance table ---
      const headerRow = sheet.getRow(headerRowIdx)
      headerRow.values = ["STT", "Ngày", "Thứ", "Giờ", "Môn học", "Điểm danh", "Ghi chú"]
      headerRow.font = { bold: true, color: { argb: EXCEL_COLORS.white } }
      headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.primary } }
      })

      sessions.forEach((s, i) => {
        const st = s.students.find(ss => ss.studentId === student.id)
        const row = sheet.getRow(headerRowIdx + 1 + i)
        row.values = [
          i + 1,
          formatDate(s.sessionDate),
          formatDayOfWeek(s.sessionDate),
          `${s.startTime}-${s.endTime}`,
          s.subject.name,
          st ? ATTENDANCE_LABEL[st.attendance as keyof typeof ATTENDANCE_LABEL] : "N/A",
          st?.note || ""
        ]

        const attendanceCell = row.getCell(6)
        if (st?.attendance === ATTENDANCE_STATUS.PRESENT) attendanceCell.font = { color: { argb: EXCEL_COLORS.present } }
        if (st?.attendance === ATTENDANCE_STATUS.ABSENT) attendanceCell.font = { color: { argb: EXCEL_COLORS.absent } }
        if (st?.attendance === ATTENDANCE_STATUS.LATE) attendanceCell.font = { color: { argb: EXCEL_COLORS.late } }
      })

      const lastRowIdx = headerRowIdx + 1 + sessions.length + 1
      sheet.mergeCells(`A${lastRowIdx}:G${lastRowIdx}`)
      sheet.getCell(`A${lastRowIdx}`).value = `Tổng: ${summary.total} | Có mặt: ${summary.present} | Vắng: ${summary.absent} | Muộn: ${summary.late} | Tỉ lệ: ${summary.rate}%`
      sheet.getCell(`A${lastRowIdx}`).font = { bold: true }

      // Column widths
      sheet.getColumn(1).width = 5   // STT
      sheet.getColumn(2).width = 12  // Ngày
      sheet.getColumn(3).width = 6   // Thứ
      sheet.getColumn(4).width = 15  // Giờ
      sheet.getColumn(5).width = 16  // Môn học
      sheet.getColumn(6).width = 16  // Điểm danh
      sheet.getColumn(7).width = 22  // Ghi chú

      // Ghi chú column: wrapText
      sheet.getColumn(7).eachCell({ includeEmpty: false }, cell => {
        cell.alignment = { ...(cell.alignment ?? {}), wrapText: true, vertical: "top" }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const filename = removeVietnameseTones(`LichHoc_${student.fullName}_${period}`)
      saveAs(new Blob([buffer]), `${filename}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }

  // Chế độ 3: Báo cáo theo lớp (cross-tab)
  const exportGradeReport = async (
    grade: number,
    students: StudentDTO[],
    sessions: SessionDTO[],
    year: number,
    month: number
  ) => {
    setIsExporting(true)
    try {
      // Filter students by grade
      const gradeStudents = students.filter(s => s.grade === grade)
      
      // Filter sessions that have students in this grade
      const gradeSessions = sessions
        .filter(s => s.students.some(st => st.grade === grade))
        .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime() || a.startTime.localeCompare(b.startTime))

      if (gradeStudents.length === 0) {
        toast.error(`Không có học sinh nào thuộc lớp ${grade} trong dữ liệu hiện tại.`)
        return
      }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet(`Lớp ${grade} - ${month}-${year}`)

      sheet.getCell("A1").value = `BÁO CÁO ĐIỂM DANH LỚP ${grade} - THÁNG ${month}/${year}`
      sheet.getCell("A1").font = { size: 14, bold: true }

      // Table Header
      const headerRow = sheet.getRow(3)
      headerRow.height = 70 // Set height to accommodate vertical text
      
      sheet.getCell("A3").value = "Học sinh"
      sheet.getCell("A3").font = { bold: true }
      sheet.getCell("A3").alignment = { vertical: "middle", horizontal: "center" }
      
      gradeSessions.forEach((s, i) => {
        const cell = sheet.getCell(3, i + 2)
        cell.value = `${formatDate(s.sessionDate).substring(0, 5)}\n${s.startTime}`
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
        cell.font = { size: 9, bold: true }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.headerBg } }
      })

      const summaryColIdx = gradeSessions.length + 2
      sheet.getCell(3, summaryColIdx).value = "Tổng"
      sheet.getCell(3, summaryColIdx).font = { bold: true }
      sheet.getCell(3, summaryColIdx).alignment = { vertical: "middle", horizontal: "center" }

      // Data rows
      gradeStudents.forEach((student, studentIdx) => {
        const rowIdx = studentIdx + 4
        sheet.getCell(rowIdx, 1).value = student.fullName
        
        let presentCount = 0
        gradeSessions.forEach((session, sessionIdx) => {
          const attendance = session.students.find(st => st.studentId === student.id)?.attendance
          const cell = sheet.getCell(rowIdx, sessionIdx + 2)
          
          if (attendance === ATTENDANCE_STATUS.PRESENT) {
            cell.value = "✓"
            cell.font = { color: { argb: EXCEL_COLORS.present } }
            presentCount++
          } else if (attendance === ATTENDANCE_STATUS.ABSENT) {
            cell.value = "✗"
            cell.font = { color: { argb: EXCEL_COLORS.absent } }
          } else if (attendance === ATTENDANCE_STATUS.LATE) {
            cell.value = "M"
            cell.font = { color: { argb: EXCEL_COLORS.late } }
            presentCount++
          } else {
            cell.value = "-"
            cell.font = { color: { argb: EXCEL_COLORS.pending } }
          }
          cell.alignment = { horizontal: "center" }
        })
        
        sheet.getCell(rowIdx, summaryColIdx).value = `${presentCount}/${gradeSessions.length}`
        sheet.getCell(rowIdx, summaryColIdx).alignment = { horizontal: "center" }
      })

      sheet.getColumn(1).width = 25
      for (let i = 0; i < gradeSessions.length; i++) {
        sheet.getColumn(i + 2).width = 10 // Increased width from 5 to 10
      }
      sheet.getColumn(summaryColIdx).width = 10

      const buffer = await workbook.xlsx.writeBuffer()
      const filename = removeVietnameseTones(`BaoCaoLop_${grade}_${month}_${year}`)
      saveAs(new Blob([buffer]), `${filename}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }

  // Chế độ 4: Tổng hợp điểm danh (multi-sheet)
  const exportAttendanceSummary = async (
    students: StudentDTO[],
    sessions: SessionDTO[],
    year: number,
    month: number
  ) => {
    setIsExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Tổng hợp")

      sheet.getCell("A1").value = `TỔNG HỢP ĐIỂM DANH - THÁNG ${month}/${year}`
      sheet.getCell("A1").font = { size: 14, bold: true }

      const headerRow = sheet.getRow(3)
      headerRow.values = ["STT", "Học sinh", "Lớp", "Tổng buổi", "Có mặt", "Vắng", "Muộn", "Tỉ lệ %"]
      headerRow.font = { bold: true }

      const sortedStudents = [...students].sort((a, b) => (a.grade - b.grade) || a.fullName.localeCompare(b.fullName))

      sortedStudents.forEach((student, i) => {
        const studentSessions = sessions.filter(s => s.students.some(st => st.studentId === student.id))
        const total = studentSessions.length
        const { present, absent, late } = studentSessions.reduce(
          (acc, s) => {
            const att = s.students.find(ss => ss.studentId === student.id)?.attendance
            if (att === ATTENDANCE_STATUS.PRESENT) acc.present++
            else if (att === ATTENDANCE_STATUS.ABSENT) acc.absent++
            else if (att === ATTENDANCE_STATUS.LATE) acc.late++
            return acc
          },
          { present: 0, absent: 0, late: 0 }
        )
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

        sheet.getRow(4 + i).values = [
          i + 1,
          student.fullName,
          student.grade,
          total,
          present,
          absent,
          late,
          `${rate}%`
        ]
      })

      sheet.columns.forEach(col => col.width = 12)
      sheet.getColumn(2).width = 25

      const buffer = await workbook.xlsx.writeBuffer()
      const filename = removeVietnameseTones(`TongHopDiemDanh_${month}_${year}`)
      saveAs(new Blob([buffer]), `${filename}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }

  return {
    isExporting,
    exportMonthlySchedule,
    exportStudentSchedule,
    exportGradeReport,
    exportAttendanceSummary,
  }
}
