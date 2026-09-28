"use client"

import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Repeat, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GRADES } from "@/lib/constants"
import { useFilters } from "@/hooks/useFilters"
import { useCalendar } from "@/hooks/useCalendar"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
import { ExportExcelButton } from "../reports/ExportExcelButton"
import type { SessionDTO, StudentDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface CalendarToolbarProps {
  onCreateClick: () => void
  onBulkCreateClick: () => void
  onCopyMonthClick: () => void
  sessions: SessionDTO[]
  students?: StudentDTO[]
}

export function CalendarToolbar({
  onCreateClick,
  onBulkCreateClick,
  onCopyMonthClick,
  sessions,
  students = []
}: CalendarToolbarProps) {
  const { t } = useTranslation()
  const {
    selectedGrade,
    setGrade,
    searchStudentName,
    setSearch,
    resetFilters,
    hasActiveFilter
  } = useFilters()

  const { monthLabel, prevMonth, nextMonth } = useCalendar()
  const copyGate = useFeatureGate("copyMonth")

  const [localSearch, setLocalSearch] = useDebouncedSearch(searchStudentName, setSearch)

  return (
    <div className="bg-white p-3 md:p-4 rounded-xl border">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        {/* Top/Left: Search & Primary Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 flex-1">
            <div className="relative w-full md:w-[240px]">
                <Input
                    placeholder={t("search_student")}
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="pr-9 h-11 md:h-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                />
                {localSearch && (
                    <button
                        onClick={() => {
                            setLocalSearch("")
                            setSearch("")
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={selectedGrade?.toString() || "all"}
                onValueChange={(val) => setGrade(val === "all" ? null : parseInt(val, 10))}
              >
                <SelectTrigger className="flex-1 sm:w-[130px] h-11 md:h-10 bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("all_grades")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_grades")}</SelectItem>
                  {GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      {t("grade")} {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 md:p-1 h-11 md:h-10">
                <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 md:h-8 md:w-8 hover:bg-white shadow-none">
                  <ChevronLeft className="size-4 md:size-5" />
                </Button>
                <span className="text-xs md:text-sm font-bold min-w-[90px] md:min-w-[110px] text-center text-slate-700">
                  {monthLabel}
                </span>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 md:h-8 md:w-8 hover:bg-white shadow-none">
                  <ChevronRight className="size-4 md:size-5" />
                </Button>
              </div>
            </div>

          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-primary h-9 px-2 hover:bg-primary/[0.08] font-medium"
            >
              <X className="size-4 mr-1" />
              {t("clear_filters")}
            </Button>
          )}
        </div>

        {/* Dưới md: hàng 1 Lịch lặp | Chép lịch tháng chia đôi, hàng 2 nút Xuất Excel vuông + Tạo ca dạy giãn hết; từ md 1 hàng như cũ. */}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-1 md:flex-wrap md:items-center md:justify-end md:border-t-0 md:pt-0">
          <ExportExcelButton
            sessions={sessions}
            students={students}
            iconOnly
            className="order-3 size-11 shrink-0 md:order-1 md:size-10"
          />

          <Button
            variant="outline"
            onClick={onBulkCreateClick}
            className="order-1 h-11 min-w-0 basis-[calc(50%-0.25rem)] grow gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 md:order-2 md:h-10 md:w-auto md:basis-auto md:grow-0"
          >
            <Repeat className="size-4" />
            <span>{t("bulk_schedule")}</span>
          </Button>

          {/* Khóa chứ không ẩn (spec I): Standard bấm mở UpgradeDialog thay vì dialog chép. */}
          <Button
            variant="outline"
            data-testid="copy-month-button"
            onClick={copyGate.guard(onCopyMonthClick)}
            className="order-2 h-11 min-w-0 basis-[calc(50%-0.25rem)] grow gap-2 border-slate-200 px-2 text-slate-600 hover:bg-slate-50 md:order-3 md:h-10 md:w-auto md:basis-auto md:grow-0 md:px-4"
          >
            <CalendarPlus className="size-4 shrink-0" />
            <span className="truncate">{t("copy_month")}</span>
            {copyGate.locked && <LockBadge plan={copyGate.requiredPlan} />}
          </Button>

          <Button onClick={onCreateClick} className="order-4 h-11 min-w-0 flex-1 gap-2 px-4 md:ml-2 md:h-10 md:w-auto md:flex-none md:px-6">
            <Plus className="size-4 md:size-5" />
            <span>{t("create_session")}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
