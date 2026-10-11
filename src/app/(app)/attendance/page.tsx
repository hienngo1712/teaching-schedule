"use client"

import { FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/common/PageHeader"
import { FilterBar, type FilterChip } from "@/components/common/FilterBar"
import { StatCard } from "@/components/common/StatCard"
import { LockBadge } from "@/components/plan/LockBadge"
import { LockedSection } from "@/components/plan/LockedSection"
import { ReportPeriodPicker } from "@/components/reports/ReportPeriodPicker"
import { AttendanceMonthView } from "@/components/attendance-report/AttendanceMonthView"
import { AttendanceYearView } from "@/components/attendance-report/AttendanceYearView"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useCalendar } from "@/hooks/useCalendar"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { useFilters } from "@/hooks/useFilters"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { GRADES } from "@/lib/constants"
import { PLAN_LABEL } from "@/lib/plans"
import { trpc } from "@/lib/trpc"
import { attendanceMonthTable, attendanceYearTable, exportAttendanceExcel } from "@/lib/attendance-export"

// Chuyên cần (spec AN §3, mẫu 09a/09b): tháng Plus; năm học + lọc lớp Pro.
export default function AttendancePage() {
  const { t } = useTranslation()
  const tr = t as unknown as (key: string) => string
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { year, month } = useCalendar()
  const { filterType, selectedGrade, setGrade, selectedPlaceId, setPlace, clearFilters } = useFilters()
  const { places, multi, placeById } = usePlaceSummary()
  const monthGate = useFeatureGate("attendanceMonth")
  const yearGate = useFeatureGate("attendanceYear")
  // Chưa Pro: ép tháng + bỏ lọc lớp dù URL còn type=school/grade (link cũ) để không gọi query bị chặn.
  const mode = yearGate.allowed && filterType === "school" ? "school" : "month"
  const grade = yearGate.allowed ? (selectedGrade ?? undefined) : undefined
  const placeId = multi ? (selectedPlaceId ?? undefined) : undefined

  const monthQuery = trpc.attendanceReport.month.useQuery({ year, month, placeId, grade }, { enabled: monthGate.allowed && mode === "month" })
  const yearQuery = trpc.attendanceReport.schoolYear.useQuery({ startYear: year, placeId, grade }, { enabled: yearGate.allowed && mode === "school" })
  const stats = mode === "school" ? yearQuery.data?.stats : monthQuery.data?.stats

  const activeChips: FilterChip[] = []
  if (grade) activeChips.push({ key: "grade", label: `${t("grade")} ${grade}`, onRemove: () => setGrade(null) })
  const place = placeById(placeId)
  if (place) activeChips.push({ key: "place", label: place.name, onRemove: () => setPlace(null) })

  const title =
    mode === "school"
      ? `${t("attendance_report")} · ${t("school_year_label").replace("{a}", String(year)).replace("{b}", String(year + 1))}`
      : `${t("attendance_report")} · ${t("month")} ${month}/${year}`
  const exportExcel = () => {
    const filename = mode === "school" ? `chuyen-can-nam-hoc-${year}-${year + 1}` : `chuyen-can-${year}-${String(month).padStart(2, "0")}`
    const table = mode === "school" ? yearQuery.data && attendanceYearTable(yearQuery.data, tr) : monthQuery.data && attendanceMonthTable(monthQuery.data, tr)
    if (!table) return
    exportAttendanceExcel(table, title, filename, t("attendance_report")).catch(() => toast.error(t("load_error")))
  }

  const statCards = (values?: typeof stats) => (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard label={t("att_rate_avg")} value={values && `${String(values.rate).replace(".", ",")}%`} hint={t("att_rate_hint")} valueClassName="text-primary" />
      <StatCard label={t("att_present")} value={values?.present} hint={t("att_present_hint")} />
      <StatCard label={t("att_absent")} value={values?.absent} valueClassName="text-debt" />
      <StatCard label={t("att_late")} value={values?.late} />
    </div>
  )

  if (monthGate.locked) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("attendance_report")} description={t("attendance_report_desc")} />
        <LockedSection plan={monthGate.requiredPlan} label={t("plan_available_in").replace("{plan}", PLAN_LABEL[monthGate.requiredPlan])} testId="attendance-locked">
          {statCards({ present: 0, late: 0, absent: 0, recorded: 0, rate: 0 })}
        </LockedSection>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("attendance_report")} description={t("attendance_report_desc")} />
      <FilterBar
        period={<ReportPeriodPicker schoolYear multiMonthLocked={yearGate.locked} onLockedClick={yearGate.openUpgrade} />}
        actions={
          <Button
            variant="outline"
            className={isDesktop ? "h-10" : "size-11 shrink-0 p-0"}
            aria-label={t("export_excel")}
            disabled={mode === "school" ? !yearQuery.data : !monthQuery.data}
            onClick={exportExcel}
          >
            <FileSpreadsheet className="size-4" />
            {isDesktop && <span className="ml-2">{t("export_excel")}</span>}
          </Button>
        }
        activeChips={activeChips}
        onClearAll={() => clearFilters(["grade", "place"])}
        filters={
          <>
            {multi && (
              <Select value={placeId ? String(placeId) : "all"} onValueChange={(v) => v && setPlace(v === "all" ? null : Number(v))}>
                <SelectTrigger aria-label={t("session_place")}>
                  <SelectValue placeholder={t("all_places")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_places")}</SelectItem>
                  {places.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {yearGate.locked ? (
              <Button type="button" variant="outline" className="h-11 w-full justify-between gap-2" onClick={yearGate.openUpgrade}>
                {t("all_grades")}
                <LockBadge plan={yearGate.requiredPlan} />
              </Button>
            ) : (
              <Select value={grade ? String(grade) : "all"} onValueChange={(v) => v && setGrade(v === "all" ? null : Number(v))}>
                <SelectTrigger aria-label={t("grade")}>
                  <SelectValue placeholder={t("grade")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_grades")}</SelectItem>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {t("grade")} {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      {statCards(stats)}

      {mode === "school" ? (
        <AttendanceYearView query={yearQuery} />
      ) : (
        <AttendanceMonthView query={monthQuery} />
      )}
    </div>
  )
}
