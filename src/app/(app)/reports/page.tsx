"use client"

import { useMemo } from "react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
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
import { ReportPeriodPicker } from "@/components/reports/ReportPeriodPicker"
type SessionItem = Omit<RouterOutputs["session"]["getMonth"][number], "sessionDate"> & { sessionDate: Date }
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function ReportsPage() {
  const { year, month } = useCalendar()
  const { t } = useTranslation()
  const { 
    selectedGrade: gradeFilter, 
    setGrade: setGradeFilter, 
    selectedStudentId, 
    setStudentId: setSelectedStudentId,
    toYear: filterToYear,
    toMonth: filterToMonth,
    filterType,
  } = useFilters()

  const queryParams = useMemo(() => {
    const params: { year: number; month: number; toYear?: number; toMonth?: number } = { year, month }
    if (filterType === 'year') {
      params.month = 1
      params.toYear = year
      params.toMonth = 12
    } else if (filterType === 'range') {
      params.toYear = filterToYear || year
      params.toMonth = filterToMonth || month
    }
    return params
  }, [year, month, filterType, filterToYear, filterToMonth])

  const { data: studentListData } = trpc.student.list.useQuery({
    grade: gradeFilter || undefined,
    limit: 1000, // For reports we want more students
  })

  const { data: monthSessionsData = [] } = trpc.session.getMonth.useQuery({
    ...queryParams,
    grade: gradeFilter || undefined,
    studentId: selectedStudentId || undefined,
    includeStudents: true,
  })

  const { data: monthlySummary } = trpc.report.monthlySummary.useQuery({
    ...queryParams,
    grade: gradeFilter || undefined,
  })

  const students = studentListData?.items ?? []
  const gap = (monthlySummary?.expectedRevenue ?? 0) - (monthlySummary?.totalRevenue ?? 0)
  const sessions = (monthSessionsData ?? []).map(s => ({
    ...s,
    sessionDate: new Date(s.sessionDate),
  })) as SessionItem[]

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t("reports")}</h1>
          
          <div className="flex flex-wrap gap-2 items-center">
            <ExportExcelButton sessions={sessions} students={students} />
            
            <ReportPeriodPicker />
            
            <Select 
              value={gradeFilter?.toString() || "all"} 
              onValueChange={(v) => {
                setGradeFilter(v === "all" ? null : parseInt(v))
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t("grade")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_grades")}</SelectItem>
                {GRADES.map(g => (
                  <SelectItem key={g} value={g.toString()}>{t("grade")} {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedStudentId?.toString() || "none"} 
              onValueChange={(v) => setSelectedStudentId(v === "none" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("student")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("select_student")}</SelectItem>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedStudentId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("student")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{monthlySummary?.totalStudents ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("attendance_rate")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-slate-700">
                  {monthlySummary ? `${monthlySummary.overallAttendanceRate}%` : "0%"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("expected_revenue")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-indigo-600">
                  {monthlySummary ? formatCurrency(monthlySummary.expectedRevenue) : "0 đ"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("actual_revenue")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-600">
                  {monthlySummary ? formatCurrency(monthlySummary.totalRevenue) : "0 đ"}
                </div>
                {gap > 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    Hụt: {formatCurrency(gap)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("collected_amount")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">
                  {monthlySummary ? formatCurrency(monthlySummary.totalPaid) : "0 đ"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("uncollected_amount")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-orange-600">
                  {monthlySummary ? formatCurrency(monthlySummary.totalOutstanding) : "0 đ"}
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
