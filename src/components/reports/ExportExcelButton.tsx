"use client"

import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useExcelExport } from "@/hooks/useExcelExport"
import { useCalendar } from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import type { SessionDTO } from "@/server/services/session.service"
import { useSession } from "next-auth/react"
import type { StudentDTO } from "@/lib/schemas/student.dto"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface ExportExcelButtonProps {
  sessions: SessionDTO[]
  students?: StudentDTO[]
}

export function ExportExcelButton({ sessions, students = [] }: ExportExcelButtonProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { isExporting, exportMonthlySchedule, exportStudentSchedule, exportGradeReport, exportAttendanceSummary } = useExcelExport()
  const { year, month } = useCalendar()
  const { selectedGrade, selectedStudentId } = useFilters()

  const teacherName = session?.user?.fullName || t("teacher_fallback")

  const displayStudents = selectedGrade
    ? students.filter(s => s.grade === selectedGrade)
    : students

  const displaySessions = selectedGrade
    ? sessions.filter(s => s.students.some(st => st.grade === selectedGrade))
    : sessions

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
          )}
          {t("export_excel")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("export_options")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => exportMonthlySchedule(displaySessions, year, month, teacherName)}>
          📅 {t("export_monthly")} {selectedGrade ? `(${t("grade")} ${selectedGrade})` : ""}
        </DropdownMenuItem>

        {selectedStudentId && sessions.length > 0 && (
          <DropdownMenuItem onClick={() => {
            const studentSessions = sessions.filter(s =>
              s.students.some(st => st.studentId === selectedStudentId)
            )
            const fullName = studentSessions[0]?.students.find(st => st.studentId === selectedStudentId)?.fullName || t("student")
            const grade = studentSessions[0]?.students.find(st => st.studentId === selectedStudentId)?.grade || 0

            const present = studentSessions.filter(s =>
              s.students.some(st => st.studentId === selectedStudentId && (st.attendance === "present" || st.attendance === "late"))
            ).length
            const absent = studentSessions.filter(s =>
              s.students.some(st => st.studentId === selectedStudentId && st.attendance === "absent")
            ).length
            const total = studentSessions.length
            const rate = total > 0 ? (present / total) * 100 : 0

            exportStudentSchedule(
              { fullName, grade },
              studentSessions,
              { total, present, absent, late: 0, rate },
              `${t("month")} ${month}/${year}`
            )
          }}>
            👤 {t("export_student")}
          </DropdownMenuItem>
        )}

        {selectedGrade && (
          <DropdownMenuItem onClick={() => exportGradeReport(selectedGrade, students, sessions, year, month)}>
            🏫 {t("export_by_grade")} {selectedGrade}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => exportAttendanceSummary(displayStudents, displaySessions, year, month)}>
          📊 {t("export_attendance")} {selectedGrade ? `(${t("grade")} ${selectedGrade})` : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
