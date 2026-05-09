"use client"

import { ChevronLeft, ChevronRight, Plus, Repeat, X } from "lucide-react"
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
import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { ExportExcelButton } from "../reports/ExportExcelButton"
import type { SessionDTO } from "@/server/services/session.service"
import type { StudentDTO } from "@/lib/schemas/student.dto"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface FilterBarProps {
  onCreateClick: () => void
  onBulkCreateClick: () => void
  sessions: SessionDTO[]
  students?: StudentDTO[]
}

export function FilterBar({
  onCreateClick,
  onBulkCreateClick,
  sessions,
  students = []
}: FilterBarProps) {
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

  const [localSearch, setLocalSearch] = useState(searchStudentName)
  const debouncedSearch = useDebounce(localSearch, 400)

  useEffect(() => {
    setSearch(debouncedSearch)
  }, [debouncedSearch, setSearch])

  useEffect(() => {
    setLocalSearch(searchStudentName)
  }, [searchStudentName])

  return (
    <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
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
              className="text-indigo-600 h-9 px-2 hover:bg-indigo-50 font-medium"
            >
              <X className="size-4 mr-1" />
              {t("clear_filters")}
            </Button>
          )}
        </div>

        {/* Bottom/Right: Actions */}
        <div className="flex items-center gap-2 pt-1 md:pt-0 border-t border-slate-100 md:border-t-0 justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <ExportExcelButton sessions={sessions} students={students} />

            <Button
              variant="outline"
              onClick={onBulkCreateClick}
              className="gap-2 h-11 md:h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Repeat className="size-4" />
              <span className="hidden sm:inline">{t("bulk_schedule")}</span>
            </Button>
          </div>
          
          <Button onClick={onCreateClick} className="gap-2 h-11 md:h-10 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 px-4 md:px-6">
            <Plus className="size-4 md:size-5" />
            <span className="hidden xs:inline">{t("create_session")}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
