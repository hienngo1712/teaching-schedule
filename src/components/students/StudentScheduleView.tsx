"use client"

import { useMemo, useRef } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ATTENDANCE_LABEL, ATTENDANCE_STATUS } from "@/lib/constants"
import { formatDate, formatDayOfWeek, calcAttendanceRate, removeVietnameseTones, formatCurrency, cn } from "@/lib/utils"
import { Wallet } from "lucide-react"
import type { SessionDTO } from "@/lib/types/models"
import { trpc } from "@/lib/trpc"
import { ExportButton } from "../reports/ExportButton"
import { usePagination } from "@/hooks/usePagination"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { TuitionStatusBadge } from "@/components/tuition/TuitionStatusBadge"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface StudentScheduleViewProps {
  studentId: number
  sessions: SessionDTO[]
  year: number
  month: number
  exportRef?: React.RefObject<HTMLDivElement>
}

export function StudentScheduleView({
  studentId,
  sessions,
  year,
  month,
  exportRef: externalRef,
}: StudentScheduleViewProps) {
  const { t } = useTranslation()
  const localRef = useRef<HTMLDivElement>(null)
  const exportRef = externalRef || localRef

  const studentInfoFromSessions = useMemo(() => {
    for (const session of sessions) {
      const s = session.students.find(st => st.studentId === studentId)
      if (s) return s
    }
    return null
  }, [sessions, studentId])

  const studentQuery = trpc.student.list.useQuery(
    { search: "", limit: 1000 },
    { enabled: !studentInfoFromSessions }
  )

  const studentInfo = useMemo(() => {
    if (studentInfoFromSessions) return studentInfoFromSessions
    if (studentQuery.data?.items) {
      return studentQuery.data.items.find(s => s.id === studentId)
    }
    return null
  }, [studentInfoFromSessions, studentQuery.data, studentId])

  const studentSessions = useMemo(() => {
    return sessions
      // Bỏ ca hủy cho khớp với server (report.student và tuition.service).
      .filter(s => s.status !== "cancelled")
      .filter(s => s.students.some(st => st.studentId === studentId))
      .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
  }, [sessions, studentId])

  const summary = useMemo(() => {
    const total = studentSessions.length
    let present = 0
    let absent = 0
    let late = 0
    let pending = 0
    let totalFee = 0
    let expectedFee = 0

    studentSessions.forEach(s => {
      const st = s.students.find(ss => ss.studentId === studentId)
      if (!st) return

      if (st.attendance === ATTENDANCE_STATUS.PRESENT) present++
      else if (st.attendance === ATTENDANCE_STATUS.ABSENT) absent++
      else if (st.attendance === ATTENDANCE_STATUS.LATE) late++
      else pending++

      expectedFee += st.fee ?? 0
      if (st.attendance === ATTENDANCE_STATUS.PRESENT || st.attendance === ATTENDANCE_STATUS.LATE) {
        totalFee += st.fee ?? 0
      }
    })

    const rate = calcAttendanceRate(present + late, total - pending)

    return { total, present, absent, late, pending, rate, totalFee, expectedFee }

  }, [studentSessions, studentId])

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalItems,
    totalPages,
  } = usePagination(studentSessions)

  if (!studentInfo && studentSessions.length === 0 && studentQuery.isPending) return null

  const filename = removeVietnameseTones(
    `LichHoc_${studentInfo?.fullName || "HS"}_Grade${studentInfo?.grade || ""}_${formatDate(new Date()).replace(/\//g, "-")}`
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ExportButton
          elementRef={exportRef as React.RefObject<HTMLDivElement>}
          filename={filename}
        />
      </div>

      <div ref={exportRef} className="space-y-4">
        <Card className="border-slate-200 shadow-md bg-white">
          <CardHeader className="bg-slate-50 border-b rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                  {t("personal_schedule")}
                </CardTitle>
                <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4">
                  <span>{t("student")}: <span className="font-semibold text-slate-700">{studentInfo?.fullName || "N/A"}</span></span>
                  <span>{t("grade")}: <span className="font-semibold text-slate-700">{studentInfo?.grade || "N/A"}</span></span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 font-bold px-3 py-1 text-sm">
                  {t("attendance_rate_with_colon")} {summary.rate}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[60px] text-center font-bold">{t("stt")}</TableHead>
                  <TableHead className="font-bold">{t("study_date")}</TableHead>
                  <TableHead className="font-bold">{t("weekday")}</TableHead>
                  <TableHead className="font-bold">{t("time")}</TableHead>
                  <TableHead className="font-bold text-right">{t("tuition_col")}</TableHead>
                  <TableHead className="font-bold">{t("subject")}</TableHead>
                  <TableHead className="font-bold">{t("attendance_col")}</TableHead>
                  <TableHead className="font-bold">{t("notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((session, index) => {
                  const studentData = session.students.find(st => st.studentId === studentId)
                  const actualIndex = (currentPage - 1) * pageSize + index + 1
                  return (
                    <TableRow key={session.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-center text-slate-500 font-medium">{actualIndex}</TableCell>
                      <TableCell className="font-medium text-slate-700">{formatDate(session.sessionDate)}</TableCell>
                      <TableCell className="text-slate-600">{formatDayOfWeek(session.sessionDate)}</TableCell>
                      <TableCell className="text-slate-600">{session.startTime} – {session.endTime}</TableCell>
                      <TableCell className="text-right font-medium text-slate-700">
                        {formatCurrency(studentData?.fee)}
                      </TableCell>
                      <TableCell className="text-slate-600">{session.subject.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border",
                            studentData?.attendance === ATTENDANCE_STATUS.PRESENT ? "bg-green-100 text-green-700 border-green-200" :
                            studentData?.attendance === ATTENDANCE_STATUS.ABSENT ? "bg-red-100 text-red-700 border-red-200" :
                            studentData?.attendance === ATTENDANCE_STATUS.LATE ? "bg-amber-100 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {studentData ? ATTENDANCE_LABEL[studentData.attendance] : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 italic text-sm max-w-[200px] truncate">
                        {studentData?.note || "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {studentSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 italic">
                      {t("no_sessions_for_student")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
          <div className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row justify-between gap-2 text-sm text-slate-600 rounded-b-lg">
            <div className="flex gap-x-4">
              <span>{t("total_sessions")} <span className="font-bold text-slate-800">{summary.total}</span></span>
              <span>{t("present")} <span className="text-green-600 font-bold">{summary.present}</span></span>
              <span>{t("absent")} <span className="text-red-600 font-bold">{summary.absent}</span></span>
              {/* "Muộn" chỉ còn ở dữ liệu cũ — ẩn khi bằng 0 */}
              {summary.late > 0 && (
                <span>{t("late")} <span className="text-amber-600 font-bold">{summary.late}</span></span>
              )}
              <span>{t("expected_revenue")}: <span className="text-indigo-600 font-bold">{formatCurrency(summary.expectedFee)}</span></span>
              <span>{t("actual_revenue")}: <span className="text-emerald-600 font-bold">{formatCurrency(summary.totalFee)}</span></span>
            </div>
            <div className="text-slate-400 italic">
              {t("export_date")} {formatDate(new Date())}
            </div>
          </div>
        </Card>

        <div className="mt-6 export-hide pb-6">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="size-5 text-indigo-600" />
                {t("tuition_status")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <TuitionStatusCard studentId={studentId} year={year} month={month} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="export-hide">
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          totalItems={totalItems}
        />
      </div>
    </div>
  )
}
function TuitionStatusCard({ studentId, year, month }: { studentId: number, year: number, month: number }) {
  const { t } = useTranslation()
  // Bản chỉ-đọc: xem báo cáo không được ghi snapshot.
  const { data: statusList, isLoading } = trpc.tuition.getMonthlyStatusReadOnly.useQuery({
    year,
    month,
    studentId,
    limit: 1,
  })

  const status = statusList?.items[0]

  if (isLoading) return <Skeleton className="h-20 w-full" />
  if (!status) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
        <p className="text-sm text-slate-500 font-medium">{t("expected_tuition")}</p>
        <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(status.totalExpected)}</p>
      </div>
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
        <p className="text-sm text-slate-500 font-medium">{t("paid")}</p>
        <p className={cn(
          "text-xl font-bold mt-1",
          status.isFullPaid ? "text-green-600" : status.paidAmount > 0 ? "text-amber-600" : "text-red-600"
        )}>
          {formatCurrency(status.paidAmount)}
        </p>
      </div>
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
        <p className="text-sm text-slate-500 font-medium">{t("status")}</p>
        <div className="mt-1">
          <TuitionStatusBadge item={status} />
        </div>
      </div>
    </div>
  )
}
