"use client"

import { useCallback, useMemo, useState } from "react"
import type { SessionDTO } from "@/server/services/session.service"

export type CalendarCell = {
  date: string // "YYYY-MM-DD"
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  sessions: SessionDTO[]
}

const VN_MONTH_LABEL = (month: number, year: number) =>
  `Tháng ${month} / ${year}`

export function buildMonthLabel(year: number, month: number): string {
  return VN_MONTH_LABEL(month, year)
}

/**
 * Convert JS getUTCDay (0=Sun..6=Sat) → Mon-first index (0=T2..6=CN).
 */
function toMondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Build calendar grid cho tháng (year, month) — week bắt đầu T2.
 * - Pad ô trống đầu cho các ngày T2..(thứ_đầu_tháng - 1)
 * - Điền ngày 1..N của tháng
 * - Pad cuối cho đủ tuần (multiple of 7)
 */
export function buildCalendarGrid(
  year: number,
  month: number,
  sessions: SessionDTO[],
  today: Date = new Date()
): { grid: CalendarCell[] } {
  const sessionMap = new Map<string, SessionDTO[]>()
  for (const s of sessions) {
    const d = s.sessionDate
    const key = ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    const arr = sessionMap.get(key) ?? []
    arr.push(s)
    sessionMap.set(key, arr)
  }

  const firstDayJsDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const startOffset = toMondayIndex(firstDayJsDay)
  const numDays = daysInMonth(year, month)

  const todayKey = ymd(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  )

  // Previous month padding
  const prevMonthYear = month === 1 ? year - 1 : year
  const prevMonthMonth = month === 1 ? 12 : month - 1
  const prevMonthDays = daysInMonth(prevMonthYear, prevMonthMonth)

  const grid: CalendarCell[] = []

  for (let i = 0; i < startOffset; i++) {
    const dayNumber = prevMonthDays - startOffset + 1 + i
    const date = ymd(prevMonthYear, prevMonthMonth, dayNumber)
    grid.push({
      date,
      dayNumber,
      isCurrentMonth: false,
      isToday: date === todayKey,
      sessions: sessionMap.get(date) ?? [],
    })
  }

  for (let d = 1; d <= numDays; d++) {
    const date = ymd(year, month, d)
    grid.push({
      date,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: date === todayKey,
      sessions: sessionMap.get(date) ?? [],
    })
  }

  // Pad cuối cho đủ multiple of 7
  const totalCells = Math.ceil(grid.length / 7) * 7
  const nextMonthYear = month === 12 ? year + 1 : year
  const nextMonthMonth = month === 12 ? 1 : month + 1
  let nextDay = 1
  while (grid.length < totalCells) {
    const date = ymd(nextMonthYear, nextMonthMonth, nextDay)
    grid.push({
      date,
      dayNumber: nextDay,
      isCurrentMonth: false,
      isToday: date === todayKey,
      sessions: sessionMap.get(date) ?? [],
    })
    nextDay++
  }

  return { grid }
}

export function useCalendar(initial?: { year?: number; month?: number }) {
  const now = new Date()
  const [year, setYear] = useState(initial?.year ?? now.getFullYear())
  const [month, setMonth] = useState(initial?.month ?? now.getMonth() + 1)

  const monthLabel = useMemo(() => buildMonthLabel(year, month), [year, month])

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }, [month])

  const goToMonth = useCallback((y: number, m: number) => {
    setYear(y)
    setMonth(m)
  }, [])

  return { year, month, monthLabel, prevMonth, nextMonth, goToMonth }
}
