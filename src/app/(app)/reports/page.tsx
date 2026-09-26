"use client"

import { useEffect, useMemo } from "react"
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
import { Button } from "@/components/ui/button"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
import { LockedSection } from "@/components/plan/LockedSection"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { PLAN_LABEL } from "@/lib/plans"
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
  const reportGate = useFeatureGate("monthlyReport")
  const multiGate = useFeatureGate("multiMonthReport")
  // Chưa Pro: ép 1 tháng + bỏ lọc lớp dù URL còn type=year/grade (link cũ) để không gọi query bị chặn.
  const reportType = multiGate.allowed ? filterType : "month"
  const grade = multiGate.allowed ? gradeFilter : null

  const queryParams = useMemo(() => {
    const params: { year: number; month: number; toYear?: number; toMonth?: number } = { year, month }
    if (reportType === 'year') {
      params.month = 1
      params.toYear = year
      params.toMonth = 12
    } else if (reportType === 'range') {
      params.toYear = filterToYear || year
      params.toMonth = filterToMonth || month
    }
    return params
  }, [year, month, reportType, filterToYear, filterToMonth])

  const { data: studentListData } = trpc.student.list.useQuery(
    {
      grade: grade || undefined,
      limit: 1000, // For reports we want more students
      // Gồm cả HS đã nghỉ để khớp với monthlySummary.totalStudents.
      includeInactive: true,
    },
    { enabled: reportGate.allowed }
  )

  const { data: monthSessionsData = [] } = trpc.session.getMonth.useQuery(
    {
      ...queryParams,
      grade: grade || undefined,
      studentId: selectedStudentId || undefined,
      includeStudents: true,
    },
    { enabled: reportGate.allowed }
  )

  const { data: monthlySummary } = trpc.report.monthlySummary.useQuery(
    {
      ...queryParams,
      grade: grade || undefined,
    },
    { enabled: reportGate.allowed }
  )

  const students = studentListData?.items ?? []
  const gap = (monthlySummary?.expectedRevenue ?? 0) - (monthlySummary?.totalRevenue ?? 0)
  const sessions = (monthSessionsData ?? []).map(s => ({
    ...s,
    sessionDate: new Date(s.sessionDate),
  })) as SessionItem[]

  const money = (v?: number) => (v === undefined ? undefined : formatCurrency(v))
  const activeFilterCount = (grade ? 1 : 0) + (selectedStudentId ? 1 : 0)

  const reportLocked = reportGate.locked
  const reportPlan = reportGate.requiredPlan
  // Vào thẳng /reports khi chưa đủ gói: khung báo cáo mờ + mở popup nâng cấp 1 lần.
  useEffect(() => {
    if (reportLocked) openUpgrade({ plan: reportPlan })
  }, [reportLocked, reportPlan])

  if (reportLocked) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("reports")} />
        <LockedSection
          plan={reportPlan}
          label={t("plan_available_in").replace("{plan}", PLAN_LABEL[reportPlan])}
          testId="reports-locked"
        >
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
            {[
              t("student"),
              t("attendance_rate"),
              t("expected_revenue"),
              t("actual_revenue"),
              t("collected_amount"),
              t("uncollected_amount"),
            ].map((label) => (
              <StatCard key={label} label={label} value="0" />
            ))}
          </div>
        </LockedSection>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports")}
        actions={
          <>
            <ExportExcelButton sessions={sessions} students={students} />
            <ReportPeriodPicker multiMonthLocked={multiGate.locked} onLockedClick={multiGate.openUpgrade} />
          </>
        }
      />

      <FilterBar
        activeCount={activeFilterCount}
        filters={
          <>
            {multiGate.locked ? (
              <Button type="button" variant="outline" className="h-10 gap-2" onClick={multiGate.openUpgrade}>
                {t("all_grades")}
                <LockBadge plan={multiGate.requiredPlan} />
              </Button>
            ) : (
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
            )}
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
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
            <StatCard label={t("student")} value={monthlySummary?.totalStudents} />
            <StatCard
              label={t("attendance_rate")}
              value={monthlySummary ? `${monthlySummary.overallAttendanceRate}%` : undefined}
            />
            <StatCard
              label={t("expected_revenue")}
              value={money(monthlySummary?.expectedRevenue)}
              hint={t("hint_expected_fees")}
            />
            <StatCard
              label={t("actual_revenue")}
              value={money(monthlySummary?.totalRevenue)}
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
              valueClassName="text-primary"
            />
            <StatCard
              label={t("uncollected_amount")}
              value={money(monthlySummary?.totalOutstanding)}
              hint={t("hint_outstanding")}
              valueClassName="text-debt"
            />
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            {t("select_student_hint")}
          </div>
        </>
      ) : reportGate.allowed ? (
        // Chờ biết gói rồi mới render: StudentReport gọi report.student ngay khi mount.
        <StudentReport studentId={selectedStudentId} {...queryParams} />
      ) : null}
    </div>
  )
}
