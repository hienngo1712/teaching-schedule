"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { cn, formatCurrency } from "@/lib/utils"
import type { ParentViewDTO } from "@/lib/types/models"
import { ParentPayBlock, isProvisionalNotice } from "./ParentPayBlock"
import { ParentComment } from "./ParentComment"
import { ParentAttendance, ParentUpcoming } from "./ParentSessions"

function MonthLink({ href, label }: { href: string | null; label: string }) {
  const base = "flex min-h-11 items-center whitespace-nowrap px-2 text-sm sm:px-3"
  if (!href) return <span className={cn(base, "text-slate-300")}>{label}</span>
  return (
    <Link href={href} className={cn(base, "font-medium text-primary")}>
      {label}
    </Link>
  )
}

// Trang link phụ huynh (spec AU A). Web (lg): 2 cột, khối thanh toán dính cột phải.
// Điện thoại: thẻ tiền → nhận xét → thanh toán → điểm danh → lịch, thanh dính đáy khi đã cuộn qua số tiền.
// Ảnh phiếu tải về vẫn dùng TuitionNoticeCard, không đổi.
export function ParentView({ view }: { view: ParentViewDTO }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const monthHref = (ym: string | null) => (ym ? `${pathname}?thang=${ym}` : null)
  const notice = view.notice
  const owing = !!notice && notice.remaining > 0
  const amountLabel = notice && isProvisionalNotice(notice)
    ? t("due_now")
    : t("parent_remaining_month").replace("{m}", String(view.month))

  const summaryRef = useRef<HTMLDivElement>(null)
  const payRef = useRef<HTMLElement>(null)
  const [barVisible, setBarVisible] = useState(false)

  // Thanh dính đáy chỉ hiện khi không thấy cả thẻ tiền lẫn khối thanh toán (tránh hiện số tiền 2 lần).
  useEffect(() => {
    if (!owing || typeof IntersectionObserver === "undefined") return
    const targets = [summaryRef.current, payRef.current].filter((el): el is HTMLElement => !!el)
    const seen = new Set<Element>(targets)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target)
          else seen.delete(e.target)
        }
        setBarVisible(seen.size === 0)
      },
      { threshold: 0.1 }
    )
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [owing])

  const gotoPay = () => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <main className={cn("min-h-screen bg-page", owing && "pb-24 lg:pb-0")}>
      <div className="mx-auto max-w-md px-4 py-6 lg:max-w-6xl lg:px-8">
        <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">{view.student.fullName}</h1>
            <p className="text-sm text-slate-600">
              {`${t("grade")} ${view.student.grade} · ${t("teacher_fallback")}: ${view.teacherName}`}
            </p>
          </div>
          <nav className="flex items-center justify-between rounded-lg border border-slate-200 bg-white lg:min-w-[360px]">
            <MonthLink href={monthHref(view.prevMonth)} label={`‹ ${t("prev_month")}`} />
            <span className="whitespace-nowrap text-sm font-semibold text-slate-900" data-testid="parent-month">
              {`${t("month")} ${view.month}/${view.year}`}
            </span>
            <MonthLink href={monthHref(view.nextMonth)} label={`${t("next_month")} ›`} />
          </nav>
        </header>

        <div className={cn("grid grid-cols-1 gap-4 lg:items-start", notice && "lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto_1fr] lg:gap-6")}>
          {owing && (
            <div
              ref={summaryRef}
              data-testid="parent-summary"
              className="flex items-center justify-between gap-3 rounded-xl bg-primary p-4 text-white lg:hidden"
            >
              <div className="min-w-0">
                <p className="text-sm opacity-90">{amountLabel}</p>
                <p className="text-2xl font-bold">{formatCurrency(notice.remaining)}</p>
              </div>
              <button
                type="button"
                onClick={gotoPay}
                className="h-11 shrink-0 whitespace-nowrap rounded-lg bg-white px-4 text-sm font-semibold text-primary"
              >
                {notice.qr ? t("parent_goto_qr") : t("parent_goto_detail")}
              </button>
            </div>
          )}

          {notice?.parentComment && (
            <ParentComment text={notice.parentComment} month={view.month} teacherName={notice.teacherName} />
          )}

          {/* Không có khi HS ở nơi tính theo ca/giờ (spec AL §4.6). */}
          {notice && (
            <ParentPayBlock
              ref={payRef}
              notice={notice}
              className="scroll-mt-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-3 lg:row-start-1"
            />
          )}

          <ParentAttendance month={view.month} sessions={view.attendance} />
          <ParentUpcoming sessions={view.upcoming} />
        </div>

        <footer className="pb-4 pt-6 text-center text-xs text-slate-500">{t("parent_footer")}</footer>
      </div>

      {owing && (
        <div
          data-testid="parent-sticky-bar"
          aria-hidden={!barVisible}
          className={cn(
            "fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(15,23,42,0.08)] transition-transform lg:hidden",
            !barVisible && "pointer-events-none translate-y-full"
          )}
        >
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{amountLabel}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(notice.remaining)}</p>
          </div>
          <button
            type="button"
            tabIndex={barVisible ? 0 : -1}
            onClick={gotoPay}
            className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-semibold text-white"
          >
            {t("parent_pay_now")}
          </button>
        </div>
      )}
    </main>
  )
}
