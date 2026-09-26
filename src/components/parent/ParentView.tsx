"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { cn, formatDate, formatDayOfWeek, vnDateParts } from "@/lib/utils"
import type { ParentSessionDTO, ParentViewDTO } from "@/lib/types/models"

const ATTENDANCE_STYLE: Record<ParentSessionDTO["attendance"], string> = {
  present: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-600",
}

function todayVn(): string {
  const { year, month, day } = vnDateParts()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function sessionLine(s: ParentSessionDTO): string {
  return `${formatDayOfWeek(s.date)} · ${formatDate(s.date).slice(0, 5)} · ${s.startTime}–${s.endTime} · ${s.subjectName}`
}

function MonthLink({ href, label }: { href: string | null; label: string }) {
  const base = "flex min-h-11 items-center px-3 text-sm"
  if (!href) return <span className={cn(base, "text-slate-300")}>{label}</span>
  return (
    <Link href={href} className={cn(base, "font-medium text-indigo-700")}>
      {label}
    </Link>
  )
}

export function ParentView({ view }: { view: ParentViewDTO }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const today = todayVn()
  const monthHref = (ym: string | null) => (ym ? `${pathname}?thang=${ym}` : null)
  const attended = view.attendance.filter(
    (s) => s.attendance === "present" || s.attendance === "late"
  ).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">{view.student.fullName}</h1>
          <p className="text-sm text-slate-600">{`${t("grade")} ${view.student.grade}`}</p>
          <p className="text-sm text-slate-600">{`${t("teacher_fallback")}: ${view.notice.teacherName}`}</p>
        </header>

        <nav className="flex items-center justify-between rounded-lg border border-slate-200 bg-white">
          <MonthLink href={monthHref(view.prevMonth)} label={`‹ ${t("prev_month")}`} />
          <span className="text-sm font-semibold text-slate-900" data-testid="parent-month">
            {`${t("month")} ${view.month}/${view.year}`}
          </span>
          <MonthLink href={monthHref(view.nextMonth)} label={`${t("next_month")} ›`} />
        </nav>

        <section>
          {/* Card của C rộng cố định 360px: máy hẹp hơn thì cuộn riêng card, không tràn cả trang. */}
          <div className="overflow-x-auto">
            <div className="mx-auto w-fit">
              <TuitionNoticeCard notice={view.notice} />
            </div>
          </div>
          {view.notice.qr && (
            <p className="mt-2 text-center text-xs text-slate-500">{t("parent_qr_hint")}</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">{`${t("parent_attendance")} ${view.month}`}</h2>
          {view.attendance.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("parent_no_sessions")}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                {t("parent_present_summary")
                  .replace("{n}", String(attended))
                  .replace("{total}", String(view.attendance.length))}
              </p>
              <ul className="mt-2 divide-y divide-slate-100">
                {view.attendance.map((s) => (
                  <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
                    <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", ATTENDANCE_STYLE[s.attendance])}>
                      {ATTENDANCE_LABEL[s.attendance]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">{t("parent_upcoming")}</h2>
          {view.upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("parent_no_upcoming")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {view.upcoming.map((s) => (
                <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
                  {s.date === today && (
                    <span className="shrink-0 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {t("today_badge")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pb-4 text-center text-xs text-slate-500">{t("parent_footer")}</footer>
      </div>
    </main>
  )
}
