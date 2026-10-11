"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PlaceNoticeCard } from "@/components/place-notice/PlaceNoticeCard"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn, formatDate, formatDayOfWeek } from "@/lib/utils"
import { formatHours, kindLabel } from "@/lib/timesheet-export"
import type { PayerSession, PayerViewDTO } from "@/server/services/place-notice.service"

const KIND_STYLE: Record<string, string> = {
  done: "bg-green-100 text-green-700",
  makeup: "bg-primary/[0.08] text-primary",
  upcoming: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-500",
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

// Trang người trả của 1 nơi dạy (spec AN §2, mẫu 13), dựng theo ParentView. Không bao giờ có tên HS: mỗi ca chỉ có số HS có mặt.
export function PayerView({ view }: { view: PayerViewDTO }) {
  const { t } = useTranslation()
  const tr = t as unknown as (key: string) => string
  const pathname = usePathname()
  const isWide = useMediaQuery("(min-width: 1024px)")
  const monthHref = (ym: string | null) => (ym ? `${pathname}?thang=${ym}` : null)

  const line = (s: PayerSession) =>
    `${formatDayOfWeek(s.date)} · ${formatDate(s.date).slice(0, 5)} · ${s.start}–${s.end} · ${s.subject}`
  const detail = (s: PayerSession) =>
    s.kind === "cancelled"
      ? null
      : `${t("ts_hours").replace("{h}", formatHours(s.hours))}${s.kind === "done" && s.totalCount > 0 ? ` · ${t("payer_present").replace("{n}", String(s.presentCount))}` : ""}`

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto max-w-md space-y-6 px-4 py-6 lg:max-w-6xl lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">{view.placeName}</h1>
            <p className="text-sm text-slate-600">{`${t("notice_teacher")}: ${view.teacherName}`}</p>
          </div>
          <nav className="flex items-center justify-between rounded-lg border border-slate-200 bg-white lg:min-w-[360px]">
            <MonthLink href={monthHref(view.prevMonth)} label={`‹ ${t("prev_month")}`} />
            <span className="text-sm font-semibold text-slate-900" data-testid="payer-month">
              {`${t("month")} ${view.month}/${view.year}`}
            </span>
            <MonthLink href={monthHref(view.nextMonth)} label={`${t("next_month")} ›`} />
          </nav>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">{t("payer_sessions_title").replace("{m}", String(view.month))}</h2>
            {view.sessions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t("payer_no_sessions")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100" data-testid="payer-sessions">
                {view.sessions.map((s, i) => {
                  const k = s.kind === "done" && s.isMakeup ? "makeup" : s.kind
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{line(s)}</p>
                        {detail(s) && <p className="text-xs text-slate-500">{detail(s)}</p>}
                      </div>
                      <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", KIND_STYLE[k])}>{kindLabel(s, tr)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Phiếu (QR) lên đầu trên điện thoại, cột phải trên laptop. */}
          <aside className="order-first space-y-2 lg:order-last lg:sticky lg:top-4">
            {view.notice ? (
              <>
                <PlaceNoticeCard notice={view.notice} variant={isWide ? "wide" : "default"} />
                {view.notice.qr && <p className="text-center text-xs text-slate-500">{t("parent_qr_hint")}</p>}
                {/* payOS (spec AO §3.3): trang thanh toán của payOS; ảnh phiếu không cần nút này. */}
                {view.notice.qr?.checkoutUrl && (
                  <a
                    href={view.notice.qr.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white"
                  >
                    {t("payos_open_checkout")}
                  </a>
                )}
              </>
            ) : (
              <p data-testid="payer-no-notice" className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                {t("payer_no_notice")}
              </p>
            )}
          </aside>
        </div>

        <footer className="pb-4 text-center text-xs text-slate-500">{t("parent_footer")}</footer>
      </div>
    </main>
  )
}
