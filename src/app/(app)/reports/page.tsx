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
import { PageHeader } from "@/components/common/PageHeader"
import { FilterBar } from "@/components/common/FilterBar"
import { StatCard } from "@/components/common/StatCard"
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
    // Gồm cả HS đã nghỉ để khớp với monthlySummary.totalStudents.
    includeInactive: true,
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

  const money = (v?: number) => (v === undefined ? undefined : formatCurrency(v))
  const activeFilterCount = (gradeFilter ? 1 : 0) + (selectedStudentId ? 1 : 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports")}
        actions={
          <>
            <ExportExcelButton sessions={sessions} students={students} />
            <ReportPeriodPicker />
          </>
        }
      />

      <FilterBar
        activeCount={activeFilterCount}
        filters={
          <>
            <Select
              value={gradeFilter?.toString() || "all"}
              onValueChange={(v) => setGradeFilter(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("grade")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_grades")}</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g.toString()}>{t("grade")} {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStudentId?.toString() || "none"}
              onValueChange={(v) => setSelectedStudentId(v === "none" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("student")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("select_student")}</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {!selectedStudentId ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label={t("student")} value={monthlySummary?.totalStudents} />
            <StatCard
              label={t("attendance_rate")}
              value={monthlySummary ? `${monthlySummary.overallAttendanceRate}%` : undefined}
            />
            <StatCard
              label={t("expected_revenue")}
              value={money(monthlySummary?.expectedRevenue)}
              hint={t("hint_expected_fees")}
              valueClassName="text-indigo-600"
            />
            <StatCard
              label={t("actual_revenue")}
              value={money(monthlySummary?.totalRevenue)}
              valueClassName="text-emerald-600"
              hint={
                <>
                  <p>{t("hint_taught_fees")}</p>
                  {gap > 0 && (
                    <p className="mt-1 text-orange-600">
                      {t("revenue_shortfall")} {formatCurrency(gap)}
                      <span className="block text-slate-500">{t("hint_not_yet_counted")}</span>
                    </p>
                  )}
                </>
              }
            />
            <StatCard
              label={t("collected_amount")}
              value={money(monthlySummary?.totalPaid)}
              hint={t("hint_collected")}
              valueClassName="text-green-600"
            />
            <StatCard
              label={t("uncollected_amount")}
              value={money(monthlySummary?.totalOutstanding)}
              hint={t("hint_outstanding")}
              valueClassName="text-orange-600"
            />
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            {t("select_student_hint")}
          </div>
        </>
      ) : (
        <StudentReport studentId={selectedStudentId} {...queryParams} />
      )}
    </div>
  )
}
