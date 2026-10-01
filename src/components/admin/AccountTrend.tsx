"use client"

import { useState } from "react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { TREND_RANGES, type TrendRange } from "@/lib/admin-stats"
import { cn } from "@/lib/utils"
import { BarChart } from "./BarChart"

const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const dmy = (day: string) => `${dm(day)}/${day.slice(0, 4)}`

export function AccountTrend() {
  const { t, language } = useTranslation()
  const [days, setDays] = useState<TrendRange>(7)
  const query = trpc.admin.accountTrend.useQuery({ days })
  const data = query.data

  const mini = (id: string, label: string, value: string) => (
    <div data-testid={`trend-${id}`} className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )

  return (
    <section data-testid="account-trend" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("admin_trend_title")}</h2>
        <div role="radiogroup" aria-label={t("admin_trend_title")} className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {TREND_RANGES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={days === n}
              onClick={() => setDays(n)}
              className={cn(
                "h-11 rounded-md px-3 text-sm font-semibold md:h-10",
                days === n ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t("admin_trend_days").replace("{n}", String(n))}
            </button>
          ))}
        </div>
      </div>

      {query.isError ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t("load_error")}</p>
          <Button variant="outline" className="h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mini("new", t("admin_trend_new"), String(data.totals.newAccounts))}
            {mini("avg", t("admin_trend_avg"), data.totals.avgPerDay.toLocaleString(language === "en" ? "en-US" : "vi-VN"))}
            {mini("returning", t("admin_trend_returning"), String(data.totals.returning))}
            {mini(
              "busiest",
              t("admin_trend_busiest"),
              data.totals.busiestDay
                ? t("admin_trend_busiest_value").replace("{date}", dm(data.totals.busiestDay.day)).replace("{n}", String(data.totals.busiestDay.count))
                : "-"
            )}
          </div>
          <BarChart
            testId="trend-chart"
            layout="grouped"
            formatMax={String}
            emptyText={t("admin_chart_empty")}
            legend={[
              { key: "new", label: t("admin_trend_new"), className: "bg-primary" },
              { key: "returning", label: t("admin_trend_legend_returning"), className: "bg-teal-300" },
              { key: "today", label: t("admin_trend_legend_today"), className: "bg-primary opacity-50" },
            ]}
            bars={data.days.map((d) => ({
              key: d.day,
              label: dm(d.day),
              faded: d.isToday,
              ariaLabel: t("admin_trend_bar_label")
                .replace("{date}", dm(d.day))
                .replace("{new}", String(d.newAccounts))
                .replace("{ret}", String(d.returning)),
              segments: [
                { key: "new", value: d.newAccounts, className: "bg-primary" },
                { key: "returning", value: d.returning, className: "bg-teal-300" },
              ],
            }))}
          />
          <p className="text-xs text-slate-500">{t("admin_trend_returning_note")}</p>
          {/* Số liệu quay lại chỉ có từ lúc triển khai K (spec K T5). */}
          {(!data.trackingSince || data.trackingSince > data.days[0].day) && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {data.trackingSince
                ? t("admin_trend_tracking_since").replace("{date}", dmy(data.trackingSince))
                : t("admin_trend_no_tracking")}
            </p>
          )}
        </>
      )}
    </section>
  )
}
