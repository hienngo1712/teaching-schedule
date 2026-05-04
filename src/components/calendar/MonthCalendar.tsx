"use client"

import { useMemo, useState, useRef } from "react"
import dayjs from "dayjs"
import { Clock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { DAY_NAMES } from "@/lib/constants"
import { trpc } from "@/lib/trpc"
import {
  buildCalendarGrid,
  useCalendar,
} from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { FilterBar } from "../filters/FilterBar"
import { StudentScheduleView } from "../students/StudentScheduleView"
import type { SessionDTO } from "@/server/services/session.service"
import { CalendarDayCell } from "./CalendarDayCell"
import { SessionFormDialog } from "../sessions/SessionFormDialog"
import { BulkCreateDialog } from "../sessions/BulkCreateDialog"
import { SessionDetailDialog } from "../sessions/SessionDetailDialog"
import { Badge } from "@/components/ui/badge"

export function MonthCalendar() {
  const { year, month } = useCalendar()
  const { filterParams, selectedStudentId } = useFilters()
  const exportRef = useRef<HTMLDivElement>(null)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [editingSession, setEditingSession] = useState<SessionDTO | undefined>()
  const [selectedSession, setSelectedSession] = useState<SessionDTO | undefined>()

  const query = trpc.session.getMonth.useQuery({ 
    year, 
    month,
    ...filterParams
  })

  const { data: students = [] } = trpc.student.list.useQuery({})

  // Convert sessionDate string từ tRPC → Date object cho buildCalendarGrid
  const sessions = useMemo<SessionDTO[]>(() => {
    return (query.data ?? []).map((s) => ({
      ...s,
      sessionDate: new Date(s.sessionDate),
    }))
  }, [query.data])

  const { grid } = useMemo(
    () => buildCalendarGrid(year, month, sessions),
    [year, month, sessions]
  )

  const sessionsByDate = useMemo(() => {
    const groups: Record<string, SessionDTO[]> = {}
    sessions.forEach((s) => {
      const dateKey = dayjs(s.sessionDate).format("YYYY-MM-DD")
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(s)
    })
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sessions])

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

  const handleSessionClick = (session: SessionDTO) => {
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
      <FilterBar 
        onCreateClick={handleCreateClick}
        onBulkCreateClick={() => setIsBulkDialogOpen(true)}
        sessions={sessions}
        students={students}
      />

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

      {/* Mobile List View */}
      <div className="md:hidden space-y-4">
        {query.isPending ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-300">
            <p className="text-slate-500 text-sm">Không có ca dạy nào trong tháng này</p>
          </div>
        ) : (
          sessionsByDate.map(([date, daySessions]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-500 uppercase">
                  {dayjs(date).format("dddd, DD/MM")}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid gap-2">
                {daySessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSessionClick(s)}
                    className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg text-left hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    <div
                      className="w-1.5 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: s.subject.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {s.title || s.subject.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <Clock className="size-3" />
                        {s.startTime} – {s.endTime}
                        <span className="text-slate-300">|</span>
                        <span>{s.studentCount} HS</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] h-5 px-1.5">
                      Chi tiết
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedStudentId && (
        <StudentScheduleView 
          studentId={selectedStudentId} 
          sessions={sessions}
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
