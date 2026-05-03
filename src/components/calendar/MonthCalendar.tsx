"use client"

import { useMemo, useState, useRef } from "react"
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
      />

      <div className="border rounded-lg overflow-hidden bg-slate-200 grid grid-cols-7 gap-px md:grid-cols-7 grid-cols-1 md:gap-px gap-0 shadow-sm">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="bg-slate-50 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider md:block hidden"
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
