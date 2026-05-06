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

  // Sync local search when reset or changed from outside (URL)
  useEffect(() => {
    setLocalSearch(searchStudentName)
  }, [searchStudentName])

  return (
    <div className="bg-white p-4 rounded-lg border shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full md:w-[200px]">
                <Input
                    placeholder="Tìm tên học sinh..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="pr-8"
                />
                {localSearch && (
                    <button
                        onClick={() => {
                            setLocalSearch("")
                            setSearch("")
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            <Select
            value={selectedGrade?.toString() || "all"}
            onValueChange={(val) => setGrade(val === "all" ? null : parseInt(val, 10))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Tất cả lớp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả lớp</SelectItem>
              {GRADES.map((grade) => (
                <SelectItem key={grade} value={grade.toString()}>
                  Lớp {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {monthLabel}
            </span>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-slate-500 h-9 px-2 hover:bg-slate-100"
            >
              <X className="size-4 mr-1" />
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <ExportExcelButton sessions={sessions} students={students} />

          <Button
            variant="outline"
            onClick={onBulkCreateClick}
            className="gap-2"
          >
            <Repeat className="size-4" />
            <span className="hidden sm:inline">Lịch lặp</span>
          </Button>
          <Button onClick={onCreateClick} className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Tạo ca dạy</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
