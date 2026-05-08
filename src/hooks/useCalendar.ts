"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { SessionDTO } from "@/server/services/session.service"
import { useTranslation } from "@/components/providers/LanguageProvider"

export type CalendarCell = {
  date: string // "YYYY-MM-DD"
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  sessions: SessionDTO[]
}

export function buildMonthLabel(year: number, month: number, t?: (key: any) => string): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (t) {
    return t("month_year_label")
      .replace("{month}", String(month))
      .replace("{year}", String(year))
  }
  return `Tháng ${month} / ${year}`
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

export function useCalendar() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const now = useMemo(() => new Date(), [])
  
  const year = useMemo(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y, 10) : now.getFullYear()
  }, [searchParams, now])

  const month = useMemo(() => {
    const m = searchParams.get("month")
    return m ? parseInt(m, 10) : now.getMonth() + 1
  }, [searchParams, now])

  const monthLabel = useMemo(() => buildMonthLabel(year, month, t), [year, month, t])

  const createQueryString = useCallback(
    (params: Record<string, string | number | null>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "") {
          newSearchParams.delete(key)
        } else {
          newSearchParams.set(key, String(value))
        }
      }

      return newSearchParams.toString()
    },
    [searchParams]
  )

  const goToMonth = useCallback((y: number, m: number) => {
    const queryString = createQueryString({ year: y, month: m })
    router.push(`${pathname}?${queryString}`)
  }, [router, pathname, createQueryString])

  const prevMonth = useCallback(() => {
    if (month === 1) {
      goToMonth(year - 1, 12)
    } else {
      goToMonth(year, month - 1)
    }
  }, [month, year, goToMonth])

  const nextMonth = useCallback(() => {
    if (month === 12) {
      goToMonth(year + 1, 1)
    } else {
      goToMonth(year, month + 1)
    }
  }, [month, year, goToMonth])

  return { year, month, monthLabel, prevMonth, nextMonth, goToMonth }
}
