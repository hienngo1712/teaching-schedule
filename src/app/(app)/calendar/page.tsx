"use client"

import { MonthCalendar } from "@/components/calendar/MonthCalendar"

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Lịch dạy</h1>
      <MonthCalendar />
    </div>
  )
}
