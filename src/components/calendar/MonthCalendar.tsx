"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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

type Props = {
  onClickEmpty?: (date: string) => void
  onClickSession?: (session: SessionDTO) => void
}

export function MonthCalendar({ onClickEmpty, onClickSession }: Props) {
  const { year, month, monthLabel, prevMonth, nextMonth } = useCalendar()

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-slate-500 bg-gray-200 rounded-t-lg overflow-hidden">
        {DAY_NAMES.map((name) => (
          <div key={name} className="bg-slate-50 py-2">
            {name}
          </div>
        ))}
      </div>

      {query.isPending ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="calendar-grid">
          {grid.map((cell, idx) => (
            <CalendarDayCell
              key={`${cell.date}-${idx}`}
              cell={cell}
              onClickEmpty={onClickEmpty}
              onClickSession={onClickSession}
            />
          ))}
        </div>
      )}
    </div>
  )
}
