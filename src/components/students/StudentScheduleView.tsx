"use client"

import { useMemo } from "react"
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
import { ATTENDANCE_LABEL, ATTENDANCE_STATUS } from "@/lib/constants"
import { formatDate, formatDayOfWeek, calcAttendanceRate, removeVietnameseTones, formatCurrency } from "@/lib/utils"
import type { SessionDTO } from "@/server/services/session.service"
import { trpc } from "@/lib/trpc"
import { ExportButton } from "../reports/ExportButton"

interface StudentScheduleViewProps {
  studentId: number
  sessions: SessionDTO[]
  exportRef?: React.RefObject<HTMLDivElement>
}

export function StudentScheduleView({
  studentId,
  sessions,
  exportRef,
}: StudentScheduleViewProps) {
  // Try to get student info from sessions
  const studentInfoFromSessions = useMemo(() => {
    for (const session of sessions) {
      const s = session.students.find(st => st.studentId === studentId)
      if (s) return s
    }
    return null
  }, [sessions, studentId])

  // Fallback: fetch student info if not found in sessions
  const studentQuery = trpc.student.list.useQuery(
    { search: "" }, 
    { enabled: !studentInfoFromSessions }
  )

  const studentInfo = useMemo(() => {
    if (studentInfoFromSessions) return studentInfoFromSessions
    if (studentQuery.data) {
      return studentQuery.data.find(s => s.id === studentId)
    }
    return null
  }, [studentInfoFromSessions, studentQuery.data, studentId])

  const studentSessions = useMemo(() => {
    return sessions
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

    studentSessions.forEach(s => {
      const st = s.students.find(ss => ss.studentId === studentId)
      if (!st) return

      if (st.attendance === ATTENDANCE_STATUS.PRESENT) present++
      else if (st.attendance === ATTENDANCE_STATUS.ABSENT) absent++
      else if (st.attendance === ATTENDANCE_STATUS.LATE) late++
      else pending++

      if (st.attendance === ATTENDANCE_STATUS.PRESENT || st.attendance === ATTENDANCE_STATUS.LATE) {
        totalFee += st.fee ?? 0
      }
    })

    const rate = calcAttendanceRate(present + late, total - pending)

    return { total, present, absent, late, pending, rate, totalFee }

  }, [studentSessions, studentId])

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
      
      <div ref={exportRef}>
        <Card className="overflow-hidden border-slate-200 shadow-md bg-white">
          <CardHeader className="bg-slate-50 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                  Lịch học cá nhân
                </CardTitle>
                <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4">
                  <span>Học sinh: <span className="font-semibold text-slate-700">{studentInfo?.fullName || "N/A"}</span></span>
                  <span>Lớp: <span className="font-semibold text-slate-700">{studentInfo?.grade || "N/A"}</span></span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 font-bold px-3 py-1 text-sm">
                  Tỉ lệ chuyên cần: {summary.rate}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[60px] text-center font-bold">STT</TableHead>
                  <TableHead className="font-bold">Ngày học</TableHead>
                  <TableHead className="font-bold">Thứ</TableHead>
                  <TableHead className="font-bold">Giờ học</TableHead>
                  <TableHead className="font-bold text-right">Học phí</TableHead>
                  <TableHead className="font-bold">Điểm danh</TableHead>
                  <TableHead className="font-bold">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentSessions.map((session, index) => {
                  const studentData = session.students.find(st => st.studentId === studentId)
                  return (
                    <TableRow key={session.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-slate-500 font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-700">{formatDate(session.sessionDate)}</TableCell>
                      <TableCell className="text-slate-600">{formatDayOfWeek(session.sessionDate)}</TableCell>
                      <TableCell className="text-slate-600">{session.startTime} – {session.endTime}</TableCell>
                      <TableCell className="text-right font-medium text-slate-700">
                        {formatCurrency(studentData?.fee)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={
                            studentData?.attendance === ATTENDANCE_STATUS.PRESENT ? "bg-green-100 text-green-700 border-green-200" :
                            studentData?.attendance === ATTENDANCE_STATUS.ABSENT ? "bg-red-100 text-red-700 border-red-200" :
                            studentData?.attendance === ATTENDANCE_STATUS.LATE ? "bg-amber-100 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          }
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
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400 italic">
                      Không có ca dạy nào cho học sinh này trong tháng.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <div className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row justify-between gap-2 text-sm text-slate-600">
            <div className="flex gap-x-4">
              <span>Tổng số buổi: <span className="font-bold text-slate-800">{summary.total}</span></span>
              <span>Có mặt: <span className="text-green-600 font-bold">{summary.present}</span></span>
              <span>Vắng: <span className="text-red-600 font-bold">{summary.absent}</span></span>
              <span>Muộn: <span className="text-amber-600 font-bold">{summary.late}</span></span>
              <span>Học phí: <span className="text-indigo-600 font-bold">{formatCurrency(summary.totalFee)}</span></span>
            </div>
            <div className="text-slate-400 italic">
              Ngày xuất: {formatDate(new Date())}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
