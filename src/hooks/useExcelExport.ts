import { useState } from "react"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { ATTENDANCE_LABEL, ATTENDANCE_STATUS } from "@/lib/constants"
import { formatDate, formatDayOfWeek, removeVietnameseTones } from "@/lib/utils"
import type { SessionDTO } from "@/server/services/session.service"
import type { StudentDTO } from "@/lib/schemas/student.dto"

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
        font: { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } },
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
    student: { fullName: string; grade: number },
    sessions: SessionDTO[],
    summary: { total: number; present: number; absent: number; late: number; rate: number },
    period: string
  ) => {
    setIsExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet(student.fullName)

      sheet.getCell("A1").value = "BÁO CÁO LỊCH HỌC CÁ NHÂN"
      sheet.getCell("A1").font = { size: 16, bold: true }
      
      sheet.getCell("A2").value = `Học sinh: ${student.fullName} | Lớp: ${student.grade}`
      sheet.getCell("A3").value = `Kỳ báo cáo: ${period} | Ngày xuất: ${formatDate(new Date())}`

      const headerRow = sheet.getRow(5)
      headerRow.values = ["STT", "Ngày", "Thứ", "Giờ", "Điểm danh", "Ghi chú"]
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
      headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
      })

      sessions.forEach((s, i) => {
        const st = s.students.find(ss => ss.fullName === student.fullName)
        const row = sheet.getRow(6 + i)
        row.values = [
          i + 1,
          formatDate(s.sessionDate),
          formatDayOfWeek(s.sessionDate),
          `${s.startTime}-${s.endTime}`,
          st ? ATTENDANCE_LABEL[st.attendance as keyof typeof ATTENDANCE_LABEL] : "N/A",
          st?.note || ""
        ]
        
        // Color for attendance
        const attendanceCell = row.getCell(5)
        if (st?.attendance === ATTENDANCE_STATUS.PRESENT) attendanceCell.font = { color: { argb: "FF22C55E" } }
        if (st?.attendance === ATTENDANCE_STATUS.ABSENT) attendanceCell.font = { color: { argb: "FFEF4444" } }
        if (st?.attendance === ATTENDANCE_STATUS.LATE) attendanceCell.font = { color: { argb: "FFF59E0B" } }
      })

      const lastRowIdx = 6 + sessions.length + 1
      sheet.getCell(`A${lastRowIdx}`).value = `Tổng: ${summary.total} | Có mặt: ${summary.present} | Vắng: ${summary.absent} | Muộn: ${summary.late} | Tỉ lệ: ${summary.rate}%`
      sheet.getCell(`A${lastRowIdx}`).font = { bold: true }

      sheet.columns.forEach(col => col.width = 15)
      sheet.getColumn(6).width = 30

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
        alert(`Không có học sinh nào thuộc lớp ${grade} trong dữ liệu hiện tại.`)
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
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } }
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
            cell.font = { color: { argb: "FF22C55E" } }
            presentCount++
          } else if (attendance === ATTENDANCE_STATUS.ABSENT) {
            cell.value = "✗"
            cell.font = { color: { argb: "FFEF4444" } }
          } else if (attendance === ATTENDANCE_STATUS.LATE) {
            cell.value = "M"
            cell.font = { color: { argb: "FFF59E0B" } }
            presentCount++
          } else {
            cell.value = "-"
            cell.font = { color: { argb: "FF9CA3AF" } }
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

      students.sort((a, b) => (a.grade - b.grade) || a.fullName.localeCompare(b.fullName))

      students.forEach((student, i) => {
        const studentSessions = sessions.filter(s => s.students.some(st => st.studentId === student.id))
        const total = studentSessions.length
        const present = studentSessions.filter(s => s.students.find(ss => ss.studentId === student.id)?.attendance === ATTENDANCE_STATUS.PRESENT).length
        const absent = studentSessions.filter(s => s.students.find(ss => ss.studentId === student.id)?.attendance === ATTENDANCE_STATUS.ABSENT).length
        const late = studentSessions.filter(s => s.students.find(ss => ss.studentId === student.id)?.attendance === ATTENDANCE_STATUS.LATE).length
        
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
