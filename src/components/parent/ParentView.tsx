"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { cn, formatDate, formatDayOfWeek, vnDateParts } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/useMediaQuery"
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
    <Link href={href} className={cn(base, "font-medium text-primary")}>
      {label}
    </Link>
  )
}

export function ParentView({ view }: { view: ParentViewDTO }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const today = todayVn()
  const isWide = useMediaQuery("(min-width: 1024px)")
  const monthHref = (ym: string | null) => (ym ? `${pathname}?thang=${ym}` : null)

  const presentCount = view.attendance.filter(
    (s) => s.attendance === "present" || s.attendance === "late"
  ).length
  const absentCount = view.attendance.filter((s) => s.attendance === "absent").length
  const totalCount = view.attendance.length

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto max-w-md space-y-6 px-4 py-6 lg:max-w-6xl lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">{view.student.fullName}</h1>
            <p className="hidden text-sm text-slate-600 lg:block">
              {`${t("grade")} ${view.student.grade} · ${t("teacher_fallback")}: ${view.notice.teacherName}`}
            </p>
            <p className="text-sm text-slate-600 lg:hidden">{`${t("grade")} ${view.student.grade}`}</p>
            <p className="text-sm text-slate-600 lg:hidden">{`${t("teacher_fallback")}: ${view.notice.teacherName}`}</p>
          </div>

          <nav className="flex items-center justify-between rounded-lg border border-slate-200 bg-white lg:min-w-[360px]">
            <MonthLink href={monthHref(view.prevMonth)} label={`‹ ${t("prev_month")}`} />
            <span className="text-sm font-semibold text-slate-900" data-testid="parent-month">
              {`${t("month")} ${view.month}/${view.year}`}
            </span>
            <MonthLink href={monthHref(view.nextMonth)} label={`${t("next_month")} ›`} />
          </nav>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          {/* Cột trái: Điểm danh & Lịch sắp tới */}
          <div className="min-w-0 space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">{`${t("parent_attendance")} ${view.month}`}</h2>

              {/* Điện thoại giữ dòng tóm tắt cũ (spec Y §4.5); 3 ô chỉ cho máy tính. */}
              {view.attendance.length > 0 && (
                <p className="mt-1 text-sm text-slate-600 lg:hidden">
                  {t("parent_present_summary")
                    .replace("{n}", String(presentCount))
                    .replace("{total}", String(totalCount))}
                </p>
              )}
              <div className="mt-3 hidden grid-cols-3 gap-2 lg:grid">
                <div data-testid="parent-stat" className="rounded-md bg-slate-50 p-2.5 text-center">
                  <p className="text-xs text-slate-500">{t("parent_stat_present")}</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">{presentCount}</p>
                </div>
                <div data-testid="parent-stat" className="rounded-md bg-slate-50 p-2.5 text-center">
                  <p className="text-xs text-slate-500">{t("parent_stat_absent")}</p>
                  <p className="mt-1 text-lg font-bold text-rose-600">{absentCount}</p>
                </div>
                <div data-testid="parent-stat" className="rounded-md bg-slate-50 p-2.5 text-center">
                  <p className="text-xs text-slate-500">{t("parent_stat_total")}</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{totalCount}</p>
                </div>
              </div>

              {view.attendance.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">{t("parent_no_sessions")}</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {view.attendance.map((s) => (
                    <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
                      <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", ATTENDANCE_STYLE[s.attendance])}>
                        {ATTENDANCE_LABEL[s.attendance]}
                      </span>
                    </li>
                  ))}
                </ul>
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
                        <span className="shrink-0 rounded bg-primary/[0.08] px-2 py-0.5 text-xs font-medium text-primary">
                          {t("today_badge")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Cột phải: Phiếu báo */}
          <aside className="order-first space-y-2 lg:order-last lg:sticky lg:top-4">
            {isWide ? (
              <TuitionNoticeCard notice={view.notice} variant="wide" />
            ) : (
              <div className="overflow-x-auto">
                <div className="mx-auto w-fit">
                  <TuitionNoticeCard notice={view.notice} variant="default" />
                </div>
              </div>
            )}
            {view.notice.qr && (
              <p className="mt-2 text-center text-xs text-slate-500">{t("parent_qr_hint")}</p>
            )}
            {/* payOS: trang thanh toán của payOS (spec AH §5); ảnh phiếu không cần nút này. */}
            {view.notice.qr?.checkoutUrl && (
              <div className="text-center">
                <a
                  href={view.notice.qr.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white md:w-auto"
                >
                  {t("payos_open_checkout")}
                </a>
              </div>
            )}
            <footer className="hidden pt-4 text-center text-xs text-slate-500 lg:block">
              {t("parent_footer")}
            </footer>
          </aside>
        </div>

        <footer className="pb-4 text-center text-xs text-slate-500 lg:hidden">
          {t("parent_footer")}
        </footer>
      </div>
    </main>
  )
}
