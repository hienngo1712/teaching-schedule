"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PERIODS, PERIOD_PRICE_FACTOR, PLAN_LABEL, planLabel, pricesFromMonthly, type PaidPlan } from "@/lib/plans"
import { monthPriceSchema } from "@/lib/schemas/plan"
import { cn, formatCurrency } from "@/lib/utils"
import { dateTimeVn } from "./admin-format"

type Monthly = Record<PaidPlan, number>
type HistoryRow = RouterOutputs["admin"]["prices"]["history"][number]

const PAID_PLANS: PaidPlan[] = ["plus", "pro"]
// P11: mobile Pro trên Plus; desktop Plus → Pro.
const PLAN_ORDER: Record<PaidPlan, string> = { plus: "order-2 md:order-1", pro: "order-1 md:order-2" }
const PERIOD_KEY = { month: "plan_period_1m", year: "plan_period_12m", "2year": "plan_period_24m" } as const

export function AdminPrices() {
  const { t } = useTranslation()
  const query = trpc.admin.prices.useQuery()
  const monthly = query.data?.monthly

  const change = (r: HistoryRow) =>
    r.previousMonthPrice === null
      ? `${t("admin_price_initial")} ${formatCurrency(r.monthPrice)}`
      : `${formatCurrency(r.previousMonthPrice)} → ${formatCurrency(r.monthPrice)}`

  const columns: Column<HistoryRow>[] = [
    { header: t("admin_price_time"), cell: (r) => dateTimeVn(r.createdAt) },
    { header: t("admin_col_plan"), cell: (r) => planLabel(r.plan) },
    { header: t("admin_price_month"), cell: change },
    { header: t("admin_price_changed_by"), cell: (r) => r.changedBy },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_prices")} />

      {monthly ? (
        // key theo giá hiện hành: Lưu xong hoặc CONFLICT nạp giá mới thì form khởi tạo lại từ giá đó.
        <PriceForm key={`${monthly.plus}-${monthly.pro}`} monthly={monthly} />
      ) : (
        query.isPending && <Skeleton className="h-64 w-full rounded-xl" />
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("admin_price_history")}</h2>
        <ResponsiveList
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
          errorText={t("load_error")}
          retryText={t("retry")}
          items={query.data?.history ?? []}
          getKey={(r) => r.id}
          columns={columns}
          emptyText={t("admin_price_no_history")}
          renderCard={(r) => (
            <div data-testid="price-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
              <p className="font-medium text-foreground">
                {planLabel(r.plan)} · {change(r)}
              </p>
              <p className="text-xs text-slate-500">
                {r.changedBy} · {dateTimeVn(r.createdAt)}
              </p>
            </div>
          )}
        />
      </section>
    </div>
  )
}

function PriceForm({ monthly }: { monthly: Monthly }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [draft, setDraft] = useState<Record<PaidPlan, number | undefined>>(monthly)
  const [confirming, setConfirming] = useState(false)
  const update = trpc.admin.updatePrices.useMutation({
    onSuccess: () => {
      toast.success(t("admin_price_saved"))
      setConfirming(false)
    },
    onError: (e) => {
      toast.error(e.message)
      setConfirming(false)
      // Bảng giá vừa đổi ở tab/admin khác: nạp giá mới, admin gõ lại (spec L 8.2).
      if (e.data?.code === "CONFLICT") void utils.admin.prices.invalidate()
    },
  })

  const rangeError = (p: PaidPlan) => !monthPriceSchema.safeParse(draft[p]).success
  const orderError = !rangeError("plus") && !rangeError("pro") && (draft.pro ?? 0) <= (draft.plus ?? 0)
  const changed = PAID_PLANS.filter((p) => draft[p] !== monthly[p])
  const canSave = !rangeError("plus") && !rangeError("pro") && !orderError && changed.length > 0 && !update.isPending
  // canSave bảo đảm 2 giá đã có khi mở hộp xác nhận.
  const next = { plus: draft.plus ?? 0, pro: draft.pro ?? 0 }
  const oldPrices = pricesFromMonthly(monthly)
  const newPrices = pricesFromMonthly(next)

  return (
    <div data-testid="admin-prices-form" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
        {PAID_PLANS.map((plan) => {
          const v = draft[plan]
          return (
            <div key={plan} data-testid={`price-${plan}`} className={cn("min-w-0 space-y-2", PLAN_ORDER[plan])}>
              <p className="text-lg font-semibold text-foreground">{PLAN_LABEL[plan]}</p>
              <p className="text-sm text-slate-600">{t("admin_price_month")}</p>
              <CurrencyInput
                aria-label={`${t("admin_price_month")} ${PLAN_LABEL[plan]}`}
                value={v}
                onChange={(n) => setDraft((d) => ({ ...d, [plan]: n }))}
                className="h-11 md:h-10"
              />
              {rangeError(plan) && <p className="text-xs text-destructive">{t("admin_price_err_range")}</p>}
              {plan === "pro" && orderError && <p className="text-xs text-destructive">{t("admin_price_err_order")}</p>}
              {v !== undefined && (
                <div className="space-y-0.5 text-sm text-slate-600">
                  <p>{t("admin_price_preview_year").replace("{amount}", formatCurrency(v * PERIOD_PRICE_FACTOR.year))}</p>
                  <p>{t("admin_price_preview_2year").replace("{amount}", formatCurrency(v * PERIOD_PRICE_FACTOR["2year"]))}</p>
                </div>
              )}
              {v !== monthly[plan] && (
                <p className="text-xs text-slate-500">{t("admin_price_current").replace("{amount}", formatCurrency(monthly[plan]))}</p>
              )}
            </div>
          )
        })}
      </div>

      <Button type="button" className="h-12 w-full md:w-auto" disabled={!canSave} onClick={() => setConfirming(true)}>
        {t("admin_price_save")}
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent data-testid="price-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_price_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin_price_confirm_note")}</AlertDialogDescription>
          </AlertDialogHeader>
          {changed.map((plan) => (
            <table key={plan} className="w-full text-sm">
              <caption className="pb-1 text-left font-semibold text-foreground">{PLAN_LABEL[plan]}</caption>
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left font-normal">
                    <span className="sr-only">{t("admin_col_period")}</span>
                  </th>
                  <th className="text-right font-normal">{t("admin_price_old")}</th>
                  <th className="text-right font-normal">{t("admin_price_new")}</th>
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="py-1">{t(PERIOD_KEY[period])}</td>
                    <td className="py-1 text-right text-slate-500">{formatCurrency(oldPrices[plan][period])}</td>
                    <td className="py-1 text-right font-semibold text-foreground">{formatCurrency(newPrices[plan][period])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10" disabled={update.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 md:h-10"
              disabled={update.isPending}
              onClick={(e) => {
                // Giữ hộp mở tới khi mutation xong (onSuccess/onError tự đóng).
                e.preventDefault()
                update.mutate({ prices: next, expected: monthly })
              }}
            >
              {t("admin_price_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
