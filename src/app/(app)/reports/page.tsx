"use client"

import { trpc } from "@/lib/trpc"
import { useCalendar } from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StudentReport } from "./StudentReport"
import { GRADES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { ExportExcelButton } from "@/components/reports/ExportExcelButton"
import type { SessionDTO } from "@/server/services/session.service"
import type { StudentDTO } from "@/lib/schemas/student.dto"

export default function ReportsPage() {
  const { year, month } = useCalendar()
  const { selectedGrade: gradeFilter, setGrade: setGradeFilter, selectedStudentId, setStudentId: setSelectedStudentId } = useFilters()

  const { data: studentList = [] } = trpc.student.list.useQuery({
    grade: gradeFilter || undefined,
  })

  const { data: monthSessions = [] } = trpc.session.getMonth.useQuery({
    year,
    month,
  })

  const { data: monthlySummary } = trpc.report.monthlySummary.useQuery({
    year,
    month,
  })

  const students = studentList as unknown as StudentDTO[]
  const sessions = (monthSessions ?? []).map(s => ({
    ...s,
    sessionDate: new Date(s.sessionDate)
  })) as unknown as SessionDTO[]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Báo cáo & Thống kê</h1>
        
        <div className="flex flex-wrap gap-2 items-center">
          <ExportExcelButton sessions={sessions} students={students} />
          
          <Select 
            value={gradeFilter?.toString() || "all"} 
            onValueChange={(v) => {
              setGradeFilter(v === "all" ? null : parseInt(v))
              setSelectedStudentId(null)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Chọn lớp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả lớp</SelectItem>
              {GRADES.map(g => (
                <SelectItem key={g} value={g.toString()}>Lớp {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedStudentId?.toString() || "none"} 
            onValueChange={(v) => setSelectedStudentId(v === "none" ? null : parseInt(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Chọn học sinh" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Chọn học sinh --</SelectItem>
              {students.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedStudentId ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase">Tổng số học sinh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase">Doanh thu tháng này</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {monthlySummary ? formatCurrency(monthlySummary.totalRevenue) : "0 đ"}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase">Tỉ lệ chuyên cần</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {monthlySummary ? `${monthlySummary.overallAttendanceRate}%` : "0%"}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <StudentReport 
          studentId={selectedStudentId} 
          year={year} 
          month={month} 
        />
      )}
    </div>
  )
}
