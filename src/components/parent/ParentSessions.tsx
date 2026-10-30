"use client"

import { useTranslation } from "@/components/providers/LanguageProvider"
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { cn, formatDate, formatDayOfWeek, vnDateParts } from "@/lib/utils"
import type { ParentSessionDTO } from "@/lib/types/models"

const BADGE: Record<ParentSessionDTO["attendance"], string> = {
  present: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-600",
}
// Chip ngày: vắng gạch ngang (spec AU A3).
const CHIP: Record<ParentSessionDTO["attendance"], string> = {
  present: "bg-green-50 text-green-700",
  late: "bg-amber-50 text-amber-700",
  absent: "bg-red-50 text-red-700 line-through",
  pending: "bg-slate-100 text-slate-600",
}
const UPCOMING_SHOWN = 3

const ddmm = (date: string) => formatDate(date).slice(0, 5)
// Tên nơi chỉ có khi GV dạy ≥ 2 nơi (spec AL §4.6).
const sessionLine = (s: ParentSessionDTO) =>
  `${formatDayOfWeek(s.date)} · ${ddmm(s.date)} · ${s.startTime}–${s.endTime} · ${s.subjectName}${s.placeName ? ` · ${s.placeName}` : ""}`

function todayVn(): string {
  const { year, month, day } = vnDateParts()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

const summaryCls = "flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden"

export function ParentAttendance({ month, sessions }: { month: number; sessions: ParentSessionDTO[] }) {
  const { t } = useTranslation()
  const present = sessions.filter((s) => s.attendance === "present" || s.attendance === "late").length
  const absent = sessions.filter((s) => s.attendance === "absent").length
  const stats = [
    { n: present, label: t("parent_stat_present"), cls: "text-emerald-700" },
    { n: absent, label: t("parent_stat_absent"), cls: "text-rose-600" },
    { n: sessions.length, label: t("parent_stat_total"), cls: "text-slate-800" },
  ]

  return (
    <section data-testid="parent-attendance" className="rounded-xl border border-slate-200 bg-white p-4 lg:col-start-1">
      <h2 className="font-semibold text-slate-900">{`${t("parent_attendance")} ${month}`}</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} data-testid="parent-stat" className="rounded-lg bg-slate-50 p-2.5 text-center">
            <p className={cn("text-xl font-bold", s.cls)}>{s.n}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t("parent_no_sessions")}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sessions.map((s) => (
              <span
                key={`${s.date}-${s.startTime}`}
                data-testid="parent-chip"
                title={ATTENDANCE_LABEL[s.attendance]}
                className={cn("rounded-md px-2.5 py-1.5 text-sm font-medium", CHIP[s.attendance])}
              >
                {`${formatDayOfWeek(s.date)} ${ddmm(s.date)}`}
                <span className="sr-only">{` ${ATTENDANCE_LABEL[s.attendance]}`}</span>
              </span>
            ))}
          </div>
          <details className="mt-2">
            <summary className={summaryCls}>
              <span>{t("parent_show_times")}</span>
              <span aria-hidden className="ml-1">▾</span>
            </summary>
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
                  <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", BADGE[s.attendance])}>
                    {ATTENDANCE_LABEL[s.attendance]}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}

export function ParentUpcoming({ sessions }: { sessions: ParentSessionDTO[] }) {
  const { t } = useTranslation()
  const today = todayVn()
  const item = (s: ParentSessionDTO) => (
    <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
      {s.date === today && (
        <span className="shrink-0 rounded bg-primary/[0.08] px-2 py-0.5 text-xs font-medium text-primary">{t("today_badge")}</span>
      )}
    </li>
  )
  const rest = sessions.slice(UPCOMING_SHOWN)

  return (
    <section data-testid="parent-upcoming" className="rounded-xl border border-slate-200 bg-white p-4 lg:col-start-1">
      <h2 className="font-semibold text-slate-900">{t("parent_upcoming")}</h2>
      {sessions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("parent_no_upcoming")}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-slate-100">{sessions.slice(0, UPCOMING_SHOWN).map(item)}</ul>
          {rest.length > 0 && (
            <details>
              <summary className={summaryCls}>
                <span>{t("parent_more_sessions").replace("{n}", String(rest.length))}</span>
                <span aria-hidden className="ml-1">▾</span>
              </summary>
              <ul className="divide-y divide-slate-100">{rest.map(item)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
