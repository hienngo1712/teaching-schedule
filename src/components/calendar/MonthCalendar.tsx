"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import dayjs from "dayjs"
import { Skeleton } from "@/components/ui/skeleton"
import { DAY_NAMES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import {
  buildCalendarGrid,
  useCalendar,
} from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { CalendarToolbar } from "./CalendarToolbar"
import { StudentScheduleView } from "../students/StudentScheduleView"
import type { SessionListDTO, SessionDTO } from "@/lib/types/models"
import { CalendarDayCell } from "./CalendarDayCell"
import { SessionListItem } from "./SessionListItem"
import { SessionFormDialog } from "../sessions/SessionFormDialog"
import { BulkCreateDialog } from "../sessions/BulkCreateDialog"
import { SessionDetailDialog } from "../sessions/SessionDetailDialog"
import { useTranslation } from "@/components/providers/LanguageProvider"

type SessionWithDate = Omit<RouterOutputs["session"]["getMonth"][number], "sessionDate"> & { sessionDate: Date }

export function MonthCalendar() {
  const { t } = useTranslation()
  const { year, month } = useCalendar()
  const { filterParams, selectedStudentId } = useFilters()
  const exportRef = useRef<HTMLDivElement>(null)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [editingSession, setEditingSession] = useState<SessionDTO | undefined>()
  const [selectedSession, setSelectedSession] = useState<SessionListDTO | undefined>()
  
  // Mobile state
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>(dayjs().format("YYYY-MM-DD"))

  // Sync selectedMobileDate khi đổi tháng/năm
  useEffect(() => {
    const currentMonthStr = dayjs(`${year}-${month}-01`).format("YYYY-MM")
    const selectedMonthStr = dayjs(selectedMobileDate).format("YYYY-MM")
    
    if (currentMonthStr !== selectedMonthStr) {
      // Nếu là tháng hiện tại (real-time) thì chọn today, ngược lại chọn ngày 1
      const isCurrentRealMonth = dayjs().format("YYYY-MM") === currentMonthStr
      if (isCurrentRealMonth) {
        setSelectedMobileDate(dayjs().format("YYYY-MM-DD"))
      } else {
        setSelectedMobileDate(dayjs(`${year}-${month}-01`).format("YYYY-MM-DD"))
      }
    }
  }, [year, month, selectedMobileDate])

  const query = trpc.session.getMonth.useQuery({ 
    year, 
    month,
    ...filterParams,
    includeStudents: !!selectedStudentId || !!filterParams.studentName
  })

  const { data: studentListData } = trpc.student.list.useQuery({ limit: 1000 })
  const students = studentListData?.items ?? []

  // Convert sessionDate string từ tRPC → Date object cho buildCalendarGrid
  const sessions = useMemo<SessionWithDate[]>(() => {
    return (query.data ?? []).map((s) => ({
      ...s,
      sessionDate: new Date(s.sessionDate),
    }))
  }, [query.data])

  const { grid } = useMemo(
    () => buildCalendarGrid(year, month, sessions),
    [year, month, sessions]
  )

  const selectedDateSessions = useMemo(() => {
    return sessions.filter((s) => dayjs(s.sessionDate).format("YYYY-MM-DD") === selectedMobileDate)
  }, [sessions, selectedMobileDate])

  const handleCreateClick = () => {
    setSelectedDate(undefined)
    setEditingSession(undefined)
    setIsDialogOpen(true)
  }

  const handleEmptyClick = (date: string) => {
    setSelectedDate(date)
    setEditingSession(undefined)
    setIsDialogOpen(true)
  }

  const handleSessionClick = (session: SessionListDTO) => {
    setSelectedSession(session)
    setIsDetailOpen(true)
  }

  const handleEditFromDetail = (session: SessionDTO) => {
    setIsDetailOpen(false)
    setEditingSession(session)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <CalendarToolbar 
        onCreateClick={handleCreateClick}
        onBulkCreateClick={() => setIsBulkDialogOpen(true)}
        sessions={sessions}
        students={students}
      />

      {/* Màu viền thẻ ca là cấp học (session-card--tieu-hoc/thcs trong globals.css), không phải màu môn */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <LegendItem className="border-blue-500 bg-blue-50" label={t("primary_school")} />
        <LegendItem className="border-emerald-500 bg-emerald-50" label={t("secondary_school")} />
        <LegendItem className="border-indigo-500 bg-indigo-50" label={t("level_mixed")} />
        <LegendItem className="border-red-300 bg-red-50" label={t("cancelled_label")} />
      </div>

      {/* Desktop Grid View */}
      <div className="hidden md:grid border rounded-lg overflow-hidden bg-slate-200 grid-cols-7 gap-px shadow-sm">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="bg-slate-50 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
          >
            {name}
          </div>
        ))}

        {query.isPending
          ? Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-none bg-white" />
            ))
          : grid.map((cell, idx) => (
              <CalendarDayCell
                key={`${cell.date}-${idx}`}
                cell={cell}
                onClickEmpty={handleEmptyClick}
                onClickSession={handleSessionClick}
              />
            ))}
      </div>

      {/* Mobile Responsive View (Grid + Daily List) */}
      <div className="md:hidden space-y-6">
        {/* Mini Calendar Grid */}
        <div className="border rounded-xl overflow-hidden bg-slate-200 grid grid-cols-7 gap-px shadow-sm">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="bg-slate-50 py-2 text-center text-[10px] font-bold text-slate-400 uppercase"
            >
              {name}
            </div>
          ))}

          {query.isPending
            ? Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-none bg-white" />
              ))
            : grid.map((cell, idx) => {
                const isSelected = cell.date === selectedMobileDate
                return (
                  <button
                    key={`${cell.date}-${idx}`}
                    onClick={() => setSelectedMobileDate(cell.date)}
                    disabled={!cell.isCurrentMonth}
                    className={cn(
                      "relative h-14 bg-white flex flex-col items-center justify-center gap-1 transition-colors",
                      !cell.isCurrentMonth && "bg-slate-50 opacity-20",
                      isSelected && "bg-indigo-50 ring-2 ring-inset ring-indigo-500 z-10",
                      cell.isToday && !isSelected && "bg-orange-50/50"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-indigo-700" : "text-slate-600",
                      cell.isToday && !isSelected && "text-orange-600"
                    )}>
                      {cell.dayNumber}
                    </span>
                    
                    {cell.sessions.length > 0 && (
                      <div className={cn(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-indigo-500" : "bg-slate-300"
                      )} />
                    )}
                  </button>
                )
              })}
        </div>

        {/* Daily Session List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <div className="size-2 rounded-full bg-indigo-500" />
              {t("schedule_of")} {dayjs(selectedMobileDate).format("DD/MM/YYYY")}
            </h3>
            {selectedDateSessions.length > 0 && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {selectedDateSessions.length} {t("sessions_suffix")}
              </span>
            )}
          </div>

          <div className="grid gap-3">
            {selectedDateSessions.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm italic">
                  {t("no_sessions_on_date").replace("{date}", dayjs(selectedMobileDate).format("DD/MM"))}
                </p>
                <button
                  onClick={() => handleEmptyClick(selectedMobileDate)}
                  className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {t("add_session")}
                </button>
              </div>
            ) : (
              selectedDateSessions.map((s) => (
                <SessionListItem key={s.id} session={s} onClick={handleSessionClick} />
              ))
            )}
          </div>
        </div>
      </div>

      {selectedStudentId && (
        <StudentScheduleView
          studentId={selectedStudentId}
          sessions={sessions}
          year={year}
          month={month}
          exportRef={exportRef}
        />
      )}

      <SessionFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialDate={selectedDate}
        editingSession={editingSession}
      />

      <BulkCreateDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
      />

      {selectedSession && (
        <SessionDetailDialog
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          session={selectedSession}
          onEdit={handleEditFromDetail}
        />
      )}
    </div>
  )
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm border-l-[3px]", className)} />
      {label}
    </span>
  )
}
