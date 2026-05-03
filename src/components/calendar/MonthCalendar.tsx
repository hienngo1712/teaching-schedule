"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DAY_NAMES } from "@/lib/constants"
import { trpc } from "@/lib/trpc"
import {
  buildCalendarGrid,
  useCalendar,
} from "@/hooks/useCalendar"
import type { SessionDTO } from "@/server/services/session.service"
import { CalendarDayCell } from "./CalendarDayCell"
import { SessionFormDialog } from "../sessions/SessionFormDialog"
import { BulkCreateDialog } from "../sessions/BulkCreateDialog"

export function MonthCalendar() {
  const { year, month, monthLabel, prevMonth, nextMonth } = useCalendar()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [editingSession, setEditingSession] = useState<SessionDTO | undefined>()

  const query = trpc.session.getMonth.useQuery({ year, month })

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
    setEditingSession(session)
    setSelectedDate(undefined)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsBulkDialogOpen(true)}
            className="gap-2"
          >
            <Repeat className="size-4" />
            Lịch lặp
          </Button>
          <Button onClick={handleCreateClick} className="gap-2">
            <Plus className="size-4" />
            Tạo ca dạy
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-slate-200 grid grid-cols-7 gap-px md:grid-cols-7 grid-cols-1 md:gap-px gap-0">
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
    </div>
  )
}
