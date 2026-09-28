"use client"

import { useState } from "react"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { trpc } from "@/lib/trpc"
import {
  REVENUE_FIRST_YEAR,
  REVENUE_KINDS,
  filterToRange,
  monthIndex,
  rangeError,
  type RevenueBucket,
  type RevenueFilter,
  type RevenueMonth,
  type YearMonth,
} from "@/lib/revenue"
import { cn, formatCurrency, vnDateParts } from "@/lib/utils"
import { fillMonth } from "./admin-format"
import { BarChart } from "./BarChart"

type Mode = RevenueFilter["mode"]
const MODES: Mode[] = ["month", "range", "year"]
const MODE_KEY = { month: "month", range: "range", year: "year" } as const
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const KIND_KEY = { new: "admin_revenue_new", renew: "admin_revenue_renew", upgrade: "admin_revenue_upgrade" } as const
const PERIOD_KEY = { month: "plan_period_1m", year: "plan_period_12m", "2year": "plan_period_24m" } as const
// Thứ tự trên → dưới trong cột chồng: nâng cấp, gia hạn, đơn mới (đáy) (spec K C9).
const SEGMENTS = [
  { kind: "upgrade", className: "bg-amber-400" },
  { kind: "renew", className: "bg-teal-300" },
  { kind: "new", className: "bg-primary" },
] as const

function Picker({ label, value, options, render, onChange }: {
  label: string
  value: number
  options: number[]
  render: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger aria-label={label} className="h-11 border-slate-200 md:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-slate-200 bg-white">
        {options.map((v) => (
          <SelectItem key={v} value={String(v)}>
            {render(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdminRevenue() {
  const { t } = useTranslation()
  const now = vnDateParts(new Date())
  const years = Array.from({ length: Math.max(1, now.year - REVENUE_FIRST_YEAR + 1) }, (_, i) => REVENUE_FIRST_YEAR + i)
  const [mode, setMode] = useState<Mode>("year")
  // from dùng chung cho chế độ Tháng (tháng đang chọn) và Năm (from.year).
  const [from, setFrom] = useState<YearMonth>({ year: now.year, month: now.month })
  const [to, setTo] = useState<YearMonth>({ year: now.year, month: now.month })

  const filter: RevenueFilter =
    mode === "month" ? { mode, ...from } : mode === "year" ? { mode, year: from.year } : { mode, from, to }
  const range = filterToRange(filter)
  const error = rangeError(range.from, range.to)
  const query = trpc.admin.revenue.useQuery(range, { enabled: error === null })
  const data = error ? undefined : query.data

  const pickMode = (m: Mode) => {
    if (m === "range" && mode !== "range") {
      setFrom({ year: from.year, month: 1 })
      setTo({ year: from.year, month: from.year === now.year ? now.month : 12 })
    }
    setMode(m)
  }
  const monthText = (m: number) => `${t("month")} ${m}`
  const money = (b: RevenueBucket) => formatCurrency(b.amount)
  const orders = (b: RevenueBucket) => t("admin_revenue_orders").replace("{n}", String(b.count))
  const monthLabel = (m: YearMonth) => fillMonth(t("admin_revenue_month_label"), m)

  const columns: Column<RevenueMonth>[] = [
    { header: t("admin_revenue_col_month"), cell: (m) => `${String(m.month).padStart(2, "0")}/${m.year}` },
    { header: t("admin_revenue_col_count"), cell: (m) => m.total.count, className: "text-right" },
    ...REVENUE_KINDS.map((k) => ({
      header: t(KIND_KEY[k]),
      cell: (m: RevenueMonth) => money(m.byKind[k]),
      className: "whitespace-nowrap text-right",
    })),
    { header: "Plus", cell: (m) => money(m.byPlan.plus), className: "whitespace-nowrap text-right" },
    { header: "Pro", cell: (m) => money(m.byPlan.pro), className: "whitespace-nowrap text-right" },
    { header: t("admin_revenue_total"), cell: (m) => <span className="font-semibold">{money(m.total)}</span>, className: "whitespace-nowrap text-right" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_revenue")} />

      <div data-testid="revenue-filter" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div role="radiogroup" aria-label={t("report_type")} className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 md:max-w-sm">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => pickMode(m)}
              className={cn(
                "h-11 rounded-md text-sm font-semibold md:h-10",
                mode === m ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t(MODE_KEY[m])}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 md:max-w-xl md:grid-cols-4">
          {mode !== "year" && (
            <Picker
              label={mode === "range" ? t("admin_revenue_from_month") : t("admin_revenue_pick_month")}
              value={from.month}
              options={MONTHS}
              render={monthText}
              onChange={(month) => setFrom({ ...from, month })}
            />
          )}
          <Picker
            label={mode === "range" ? t("admin_revenue_from_year") : t("admin_revenue_pick_year")}
            value={from.year}
            options={years}
            render={String}
            onChange={(year) => setFrom({ ...from, year })}
          />
          {mode === "range" && (
            <>
              <Picker label={t("admin_revenue_to_month")} value={to.month} options={MONTHS} render={monthText} onChange={(month) => setTo({ ...to, month })} />
              <Picker label={t("admin_revenue_to_year")} value={to.year} options={years} render={String} onChange={(year) => setTo({ ...to, year })} />
            </>
          )}
        </div>
        {error && (
          <p data-testid="revenue-error" className="text-sm text-destructive">
            {t(error === "order" ? "admin_revenue_err_order" : "admin_revenue_err_long")}
          </p>
        )}
        <p className="text-xs text-slate-500">{t("admin_revenue_note")}</p>
      </div>

      {!error && (
        <>
          {data && (
            <div data-testid="revenue-summary" className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div data-testid="revenue-total" className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{t("admin_revenue_total")}</p>
                  <p className="text-xl font-bold text-primary">{money(data.summary.total)}</p>
                  <p className="text-xs text-slate-500">{orders(data.summary.total)}</p>
                </div>
                {REVENUE_KINDS.map((k) => (
                  <div key={k} data-testid={`revenue-kind-${k}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">{t(KIND_KEY[k])}</p>
                    <p className="text-lg font-semibold text-foreground">{money(data.summary.byKind[k])}</p>
                    <p className="text-xs text-slate-500">{orders(data.summary.byKind[k])}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <p className="mb-2 font-semibold">{t("admin_revenue_by_plan")}</p>
                  {(["plus", "pro"] as const).map((p) => (
                    <p key={p} data-testid={`revenue-plan-${p}`} className="flex justify-between gap-2 py-1">
                      <span>{p === "plus" ? "Plus" : "Pro"} · {orders(data.summary.byPlan[p])}</span>
                      <span className="font-medium">{money(data.summary.byPlan[p])}</span>
                    </p>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <p className="mb-2 font-semibold">{t("admin_revenue_by_period")}</p>
                  {(["month", "year", "2year"] as const).map((p) => (
                    <p key={p} data-testid={`revenue-period-${p}`} className="flex justify-between gap-2 py-1">
                      <span>{t(PERIOD_KEY[p])} · {orders(data.summary.byPeriod[p])}</span>
                      <span className="font-medium">{money(data.summary.byPeriod[p])}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Khoảng 1 tháng thì 1 cột không nói gì thêm so với số tổng (spec K C10). */}
          {data && monthIndex(range.from) !== monthIndex(range.to) && (
            <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{t("admin_revenue_chart")}</h2>
              <BarChart
                testId="revenue-chart"
                layout="stacked"
                formatMax={formatCurrency}
                emptyText={t("admin_revenue_empty")}
                legend={[...SEGMENTS].reverse().map((s) => ({ key: s.kind, label: t(KIND_KEY[s.kind]), className: s.className }))}
                bars={data.months.map((m) => ({
                  key: `${m.year}-${String(m.month).padStart(2, "0")}`,
                  label: `${m.month}/${String(m.year).slice(2)}`,
                  ariaLabel: `${monthLabel(m)}: ${money(m.total)}`,
                  segments: SEGMENTS.map((s) => ({ key: s.kind, value: m.byKind[s.kind].amount, className: s.className })),
                }))}
              />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("admin_revenue_by_month")}</h2>
            <ResponsiveList
              isLoading={query.isPending}
              isError={query.isError}
              onRetry={() => query.refetch()}
              errorText={t("load_error")}
              retryText={t("retry")}
              items={data?.months ?? []}
              getKey={(m) => `${m.year}-${m.month}`}
              columns={columns}
              emptyText={t("admin_revenue_empty")}
              renderCard={(m) => (
                <div data-testid="revenue-month-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{monthLabel(m)}</p>
                    <p className="font-semibold text-foreground">{money(m.total)}</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {t("admin_revenue_new")} {money(m.byKind.new)} · {t("admin_revenue_renew")} {money(m.byKind.renew)} · {t("admin_revenue_upgrade")} {money(m.byKind.upgrade)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Plus {money(m.byPlan.plus)} · Pro {money(m.byPlan.pro)} · {orders(m.total)}
                  </p>
                </div>
              )}
            />
          </section>
        </>
      )}
    </div>
  )
}
