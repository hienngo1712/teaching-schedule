"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterBar } from "@/components/common/FilterBar"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { StatCard } from "@/components/common/StatCard"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { formatHours } from "@/lib/timesheet-export"
import { IncomeStatusBadge } from "./IncomeStatusBadge"
import { IncomeDetailSheet } from "./IncomeDetailSheet"

type Row = RouterOutputs["income"]["month"][number]
type StatusFilter = "all" | "unpaid" | "partial" | "paid"

// Tab Thu nhập (mẫu 10, theo trang Học phí): mỗi nơi theo ca/giờ có đơn giá là 1 dòng; nơi chưa có giá không hiện.
export function IncomeTab({ year, month, period }: { year: number; month: number; period: ReactNode }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<StatusFilter>("all")
  const [selected, setSelected] = useState<Row | null>(null)
  const query = trpc.income.month.useQuery({ year, month })
  const all = query.data ?? []
  const items = status === "all" ? all : all.filter((r) => r.status === status)

  const rate = (r: Row) =>
    t(r.unit === "hour" ? "income_rate_hour" : "income_rate_session").replace("{amount}", formatCurrency(r.amount))
  const count = (r: Row) => `${t("ts_count").replace("{n}", String(r.doneCount))} · ${t("ts_hours").replace("{h}", formatHours(r.doneHours))}`
  const extra = (r: Row) =>
    r.received > r.expected
      ? t("income_overpaid").replace("{amount}", formatCurrency(r.received - r.expected))
      : r.status === "partial"
        ? t("income_shortfall").replace("{amount}", formatCurrency(r.expected - r.received))
        : null

  const columns: Column<Row>[] = [
    { header: t("stt"), cell: (_, i) => i + 1, className: "w-[60px] text-center text-slate-400" },
    {
      header: t("income_col_place"),
      cell: (r) => (
        <span className="flex items-center gap-2 font-medium text-slate-900">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
          {r.name}
        </span>
      ),
    },
    { header: t("income_col_count"), cell: count, className: "whitespace-nowrap text-slate-600" },
    { header: t("income_col_rate"), cell: rate, className: "whitespace-nowrap text-slate-600" },
    { header: t("income_expected"), cell: (r) => formatCurrency(r.expected), className: "whitespace-nowrap text-right font-medium tabular-nums" },
    { header: t("income_received"), cell: (r) => formatCurrency(r.received), className: "whitespace-nowrap text-right tabular-nums text-primary" },
    {
      header: t("ts_col_status"),
      cell: (r) => (
        <div className="space-y-1">
          <IncomeStatusBadge status={r.status} />
          {extra(r) && <p className="text-xs text-slate-500">{extra(r)}</p>}
        </div>
      ),
      className: "w-44",
    },
  ]

  const expected = all.reduce((a, r) => a + r.expected, 0)
  const received = all.reduce((a, r) => a + r.received, 0)

  return (
    <div className="space-y-4">
      <FilterBar
        period={period}
        primaryFilter={
          <Select value={status} onValueChange={(v) => v && setStatus(v as StatusFilter)}>
            <SelectTrigger aria-label={t("ts_col_status")} className="h-11 w-auto gap-2 md:h-10 md:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("income_all_status")}</SelectItem>
              <SelectItem value="unpaid">{t("income_status_unpaid")}</SelectItem>
              <SelectItem value="partial">{t("income_status_partial")}</SelectItem>
              <SelectItem value="paid">{t("income_status_paid")}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {query.isSuccess && all.length === 0 ? (
        <div data-testid="income-empty" className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
          <MapPin className="mx-auto size-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm text-slate-600">{t("income_empty")}</p>
          <Button asChild className="mt-4 h-11 md:h-10">
            <Link href="/places">{t("open_places")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
            <StatCard label={t("income_expected")} value={query.data && formatCurrency(expected)} />
            <StatCard label={t("income_received")} value={query.data && formatCurrency(received)} valueClassName="text-primary" />
            {/* 3 ô trên lưới 2 cột (mobile): ô thứ 3 chiếm cả hàng để không lỗ. */}
            <div className="col-span-2 lg:col-span-1">
              <StatCard
                label={t("income_remaining")}
                value={query.data && formatCurrency(all.reduce((a, r) => a + Math.max(0, r.expected - r.received), 0))}
                valueClassName="text-debt"
              />
            </div>
          </div>
          <ResponsiveList
            items={items}
            getKey={(r) => r.placeId}
            columns={columns}
            onRowClick={setSelected}
            isLoading={query.isPending}
            isError={query.isError}
            onRetry={() => query.refetch()}
            errorText={t("load_error")}
            retryText={t("retry")}
            emptyText={t("income_empty")}
            renderCard={(r) => (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelected(r)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(r)}
                className="rounded-lg border bg-white p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <IncomeStatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {count(r)} · {rate(r)}
                </p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-slate-900">{formatCurrency(r.expected)}</p>
                    <p className="text-xs text-slate-500">
                      {t("income_received")} {formatCurrency(r.received)}
                    </p>
                  </div>
                  {extra(r) && <p className="text-xs font-medium text-slate-600">{extra(r)}</p>}
                </div>
              </div>
            )}
          />
        </>
      )}

      <IncomeDetailSheet
        target={selected && { placeId: selected.placeId, name: selected.name, color: selected.color, year, month }}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  )
}
