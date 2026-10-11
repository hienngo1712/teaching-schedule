"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { RouterOutputs } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { rateText, rateTone } from "./AttendanceMonthView"

type Data = RouterOutputs["attendanceReport"]["schoolYear"]
type Query = { data?: Data; isPending: boolean; isError: boolean; refetch: () => unknown }

// Năm học (mẫu 09b): mỗi HS 1 dải 9 ô (T9 → T5) màu theo tỉ lệ từng tháng + tỉ lệ cả năm.
export function AttendanceYearView({ query }: { query: Query }) {
  const { t } = useTranslation()
  if (query.isPending) return <Skeleton className="h-48 w-full rounded-lg" />
  if (query.isError || !query.data)
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-sm text-slate-600">{t("load_error")}</p>
        <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    )
  const { months, students } = query.data
  if (students.length === 0)
    return <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-slate-500">{t("att_empty")}</p>

  return (
    <div className="rounded-lg border bg-white" data-testid="attendance-year">
      <div className="hidden grid-cols-[minmax(0,1fr)_repeat(9,2.25rem)_4rem] items-center gap-1 border-b px-4 py-2 text-xs font-medium text-slate-500 md:grid">
        <span>{t("student")}</span>
        {months.map((m) => (
          <span key={`${m.year}-${m.month}`} className="text-center">{`T${m.month}`}</span>
        ))}
        <span className="text-right">{t("att_year_rate")}</span>
      </div>
      <ul className="divide-y">
        {students.map((s) => (
          <li key={s.studentId} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_repeat(9,2.25rem)_4rem] md:items-center md:gap-1">
            <div className="flex items-baseline justify-between gap-2 md:block">
              <p className="truncate text-sm font-medium text-slate-900">
                {s.fullName}
                {s.isDeleted && <span className="ml-1 text-xs font-normal text-slate-400">({t("att_deleted")})</span>}
              </p>
              <p className="text-xs text-slate-500">
                {t("grade")} {s.grade}
                <span className="font-semibold text-slate-700 md:hidden"> · {rateText(s.rate)}</span>
              </p>
            </div>
            <div className="grid grid-cols-9 gap-1 md:contents">
              {s.months.map((m) => (
                <div key={`${m.year}-${m.month}`} className="space-y-0.5 text-center">
                  <div
                    title={`T${m.month}/${m.year}: ${rateText(m.rate)}`}
                    aria-label={`T${m.month}/${m.year}: ${rateText(m.rate)}`}
                    className={cn("mx-auto h-6 w-full max-w-9 rounded", rateTone(m.rate))}
                  />
                  <span className="block text-[10px] text-slate-400 md:hidden">{`T${m.month}`}</span>
                </div>
              ))}
            </div>
            <span className="hidden text-right text-sm font-semibold tabular-nums text-slate-700 md:block">{rateText(s.rate)}</span>
          </li>
        ))}
      </ul>
      {/* Chú thích: màu không phải nguồn duy nhất (mỗi ô có title/aria-label số %). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-slate-500" data-testid="attendance-legend">
        {(
          [
            [95, "att_legend_high"],
            [80, "att_legend_mid"],
            [50, "att_legend_low"],
            [null, "att_legend_none"],
          ] as const
        ).map(([rate, key]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3 rounded-sm", rateTone(rate))} />
            {t(key)}
          </span>
        ))}
      </div>
    </div>
  )
}
