"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { FilterBar, type FilterChip } from "@/components/common/FilterBar"
import { PageHeader } from "@/components/common/PageHeader"
import { CreateSessionSplitButton } from "./CreateSessionSplitButton"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
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
    clearFilters,
    selectedPlaceId,
    setPlace,
  } = useFilters()
  const { places, multi, placeById } = usePlaceSummary()

  const { monthLabel, prevMonth, nextMonth } = useCalendar()

  const [localSearch, setLocalSearch] = useDebouncedSearch(searchStudentName, setSearch)

  const activeChips: FilterChip[] = []
  if (selectedGrade) activeChips.push({ key: "grade", label: `${t("grade")} ${selectedGrade}`, onRemove: () => setGrade(null) })
  const filterPlace = multi ? placeById(selectedPlaceId) : undefined
  if (filterPlace) activeChips.push({ key: "place", label: filterPlace.name, onRemove: () => setPlace(null) })
  if (searchStudentName) {
    activeChips.push({
      key: "search",
      label: `“${searchStudentName}”`,
      onRemove: () => {
        setLocalSearch("")
        setSearch("")
      },
    })
  }

  // AK: tiêu đề + Tạo ca dạy ▾ ở đầu trang; thanh lọc dùng FilterBar chung, Xuất Excel là menu con trong ⋯.
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("calendar")}
        actions={
          <CreateSessionSplitButton onCreate={onCreateClick} onBulkCreate={onBulkCreateClick} onCopyMonth={onCopyMonthClick} />
        }
      />
      <FilterBar
        search={{ value: localSearch, onChange: setLocalSearch, placeholder: t("search_student") }}
        filters={
          <>
          <Select
            value={selectedGrade?.toString() || "all"}
            onValueChange={(val) => setGrade(val === "all" ? null : parseInt(val, 10))}
          >
            <SelectTrigger aria-label={t("grade")}>
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
          {multi && (
            <Select value={selectedPlaceId ? String(selectedPlaceId) : "all"} onValueChange={(v) => setPlace(v === "all" ? null : Number(v))}>
              <SelectTrigger aria-label={t("session_place")}>
                <SelectValue placeholder={t("all_places")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_places")}</SelectItem>
                {places.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          </>
        }
        activeChips={activeChips}
        // Chỉ bỏ lớp + chữ tìm, giữ tháng đang xem (tháng không phải chip lọc).
        onClearAll={() => {
          setLocalSearch("")
          clearFilters(["grade", "studentName", "place"])
        }}
        period={
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="size-9">
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-[110px] whitespace-nowrap px-2 text-center text-sm font-semibold">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="size-9">
              <ChevronRight className="size-5" />
            </Button>
          </div>
        }
        moreContent={<ExportExcelButton sessions={sessions} students={students} asSubmenu />}
      />
    </div>
  )
}
