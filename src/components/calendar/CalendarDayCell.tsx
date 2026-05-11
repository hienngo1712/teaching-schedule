"use client"

import type { CalendarCell } from "@/hooks/useCalendar"
import type { SessionListDTO } from "@/lib/types/models"
import { cn } from "@/lib/utils"
import { SessionCard } from "./SessionCard"

type Props = {
  cell: CalendarCell
  onClickEmpty?: (date: string) => void
  onClickSession?: (session: SessionListDTO) => void
}

export function CalendarDayCell({
  cell,
  onClickEmpty,
  onClickSession,
}: Props) {
  const handleEmptyClick = () => {
    if (cell.isCurrentMonth && cell.sessions.length === 0) {
      onClickEmpty?.(cell.date)
    }
  }

  return (
    <div
      onClick={handleEmptyClick}
      className={cn(
        "calendar-day-cell",
        cell.isToday && "calendar-day-cell--today",
        !cell.isCurrentMonth && "calendar-day-cell--outside",
        cell.isCurrentMonth &&
          cell.sessions.length === 0 &&
          "cursor-pointer hover:bg-slate-50"
      )}
    >
      <div className="text-xs font-medium text-slate-700">{cell.dayNumber}</div>
      <div className="flex flex-col gap-1">
        {cell.sessions.map((s) => (
          <SessionCard key={s.id} session={s} onClick={onClickSession} />
        ))}
      </div>
    </div>
  )
}
