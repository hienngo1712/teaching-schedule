"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import {
  PERIODS,
  PERIOD_MONTHS,
  PLAN_LABEL,
  PLAN_PRICES,
  STUDENT_LIMITS,
  addDays,
  computeBonusMonths,
  computeNewExpiry,
  computeUpgradeCredit,
  featuresAddedIn,
  formatValidUntil,
  orderBlockedUntil,
  type PaidPlan,
  type Period,
  type PlanFields,
} from "@/lib/plans"
import { cn, formatCurrency } from "@/lib/utils"
import { FEATURE_LABEL_KEY } from "./feature-labels"
import { PendingOrderCard } from "./PendingOrderCard"

export type PlanChoice = { plan: PaidPlan; period: Period }
type Me = RouterOutputs["plan"]["me"]
type Props = { open: boolean; onOpenChange: (open: boolean) => void; me: Me; fields: PlanFields; initialPlan: PaidPlan }

const PAID_PLANS: PaidPlan[] = ["plus", "pro"]
// P11: mobile Pro trên Plus; desktop Plus → Pro (trái sang phải).
const PLAN_ORDER: Record<PaidPlan, string> = { plus: "order-2 md:order-1", pro: "order-1 md:order-2" }
const BELOW: Record<PaidPlan, "standard" | "plus"> = { plus: "standard", pro: "plus" }
const DESC_KEY = { plus: "plan_desc_plus", pro: "plan_desc_pro" } as const
const PERIOD_KEY = { month: "plan_period_1m", year: "plan_period_12m", "2year": "plan_period_24m" } as const

const optionClass = (selected: boolean) =>
  cn(
    "flex min-w-0 flex-col gap-2 rounded-xl p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    selected ? "border-2 border-primary bg-primary/[0.04]" : "border border-slate-200 bg-white hover:bg-slate-50"
  )

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-primary" : "border-slate-300"
      )}
    >
      {selected && <span className="size-2 rounded-full bg-primary" />}
    </span>
  )
}

export function PlanPurchaseDialog({ open, onOpenChange, me, fields, initialPlan }: Props) {
  const { t } = useTranslation()
  // P11: kỳ Năm chọn sẵn; trang mount lại dialog mỗi lần mở nên state tự về mặc định.
  const [choice, setChoice] = useState<PlanChoice>({ plan: initialPlan, period: "year" })
  const [createdId, setCreatedId] = useState<number | null>(null)

  const now = new Date()
  const plusBlockedUntil = orderBlockedUntil(fields, "plus", now)
  const bonusOf = (period: Period) => computeBonusMonths(fields, choice.plan, period, now)
  // Xem trước: ưu đãi chốt lúc tạo đơn, ngày quy đổi tính lại lúc admin duyệt (server là chuẩn).
  const bonus = bonusOf(choice.period)
  const credit = choice.plan === "pro" ? computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, now) : null
  const newExpiry = addDays(computeNewExpiry(fields, choice.plan, choice.period, now, bonus), credit?.creditDays ?? 0)
  const price = PLAN_PRICES[choice.plan][choice.period]

  const create = trpc.plan.createOrder.useMutation({
    onSuccess: (res) => {
      toast.success(t("plan_order_created"))
      setCreatedId(res.id)
    },
    onError: (e) => toast.error(e.message),
  })

  // Chỉ hiện đơn vừa tạo: lúc chưa refetch xong, me.pendingOrder có thể còn là đơn cũ (đã bị hủy ở server).
  const createdOrder = createdId !== null && me.pendingOrder?.id === createdId ? me.pendingOrder : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="plan-purchase"
        aria-describedby={undefined}
        className="h-[100dvh] w-full max-w-none content-start gap-5 overflow-y-auto rounded-none p-4 sm:rounded-none md:h-auto md:max-h-[90dvh] md:max-w-4xl md:rounded-xl md:p-6 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
      >
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{t("plan_purchase_title")}</DialogTitle>
        </DialogHeader>

        {createdId !== null ? (
          <div className="space-y-4">
            {createdOrder ? (
              <PendingOrderCard order={createdOrder} paymentReady={me.paymentReady} onCancelled={() => onOpenChange(false)} />
            ) : (
              <Skeleton className="h-64 w-full rounded-xl" />
            )}
            <Button type="button" className="h-12 w-full" onClick={() => onOpenChange(false)}>
              {t("plan_done")}
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-5">
              <div role="radiogroup" aria-label={t("admin_col_plan")} className="flex flex-col gap-3 md:grid md:grid-cols-2">
                {PAID_PLANS.map((plan) => {
                  const selected = choice.plan === plan
                  const blocked = plan === "plus" && plusBlockedUntil !== null
                  return (
                    <button
                      key={plan}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={blocked}
                      data-testid={`purchase-plan-${plan}`}
                      onClick={() => setChoice((c) => ({ ...c, plan }))}
                      className={cn(optionClass(selected), PLAN_ORDER[plan])}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <RadioDot selected={selected} />
                        <span className="text-lg font-semibold text-foreground">{PLAN_LABEL[plan]}</span>
                        {plan === "pro" && (
                          <span className="rounded-full bg-primary px-2 text-xs font-medium leading-5 text-primary-foreground">
                            {t("plan_recommended")}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-slate-600">
                        <span className="text-xl font-semibold text-foreground">{formatCurrency(PLAN_PRICES[plan].month)}</span>
                        {t("plan_per_month")}
                      </span>
                      <span className="text-sm text-slate-600">{t(DESC_KEY[plan])}</span>
                      <span className="space-y-1 text-sm text-slate-700">
                        <span className="block font-medium">{t("plan_includes_below").replace("{plan}", PLAN_LABEL[BELOW[plan]])}</span>
                        {featuresAddedIn(plan).map((id) => (
                          <span key={id} className="flex gap-2">
                            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{t(FEATURE_LABEL_KEY[id])}</span>
                          </span>
                        ))}
                        {plan === "plus" && (
                          <span className="block font-medium">
                            {t("plan_student_limit").replace("{n}", String(STUDENT_LIMITS.plus))}
                          </span>
                        )}
                      </span>
                      {blocked && plusBlockedUntil && (
                        <span className="text-xs text-slate-500">
                          {t("plan_downgrade_blocked").replace("{date}", formatValidUntil(plusBlockedUntil))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("plan_duration")}</p>
                <div role="radiogroup" aria-label={t("plan_duration")} className="flex flex-col gap-2 md:grid md:grid-cols-3">
                  {PERIODS.map((period) => {
                    const selected = choice.period === period
                    const b = bonusOf(period)
                    // Q11: ghi đúng số tháng tặng hôm nay; năm không tặng thì nhắc tiết kiệm 2 tháng.
                    const tag = b > 0 ? t("plan_bonus_months").replace("{n}", String(b)) : period === "year" ? t("plan_save_2_months") : null
                    return (
                      <button
                        key={period}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-testid={`purchase-period-${period}`}
                        onClick={() => setChoice((c) => ({ ...c, period }))}
                        className={cn(optionClass(selected), "gap-1 p-3")}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <RadioDot selected={selected} />
                            {t(PERIOD_KEY[period])}
                          </span>
                          {tag && (
                            <span className="rounded-full bg-primary/10 px-2 text-xs font-medium leading-5 text-primary">{tag}</span>
                          )}
                        </span>
                        <span className="text-lg font-semibold text-foreground">{formatCurrency(PLAN_PRICES[choice.plan][period])}</span>
                        {/* Q12: ngày quy đổi D7 không cộng vào N, chỉ hiện ở Đơn hàng. */}
                        <span className="text-xs text-slate-500">
                          {t("plan_max_months").replace("{n}", String(PERIOD_MONTHS[period] + b))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <aside
              data-testid="purchase-summary"
              className="min-w-0 space-y-3 rounded-xl bg-slate-50 p-4 lg:sticky lg:top-0 lg:self-start"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("plan_order_summary")}</p>
              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {PLAN_LABEL[choice.plan]} · {t(PERIOD_KEY[choice.period])}
                </span>
                <span className="shrink-0">{formatCurrency(price)}</span>
              </div>
              {bonus > 0 && <p className="text-sm font-medium text-primary">{t("plan_bonus_months").replace("{n}", String(bonus))}</p>}
              {credit && credit.creditDays > 0 && (
                <p className="text-sm text-slate-600">
                  {t("plan_upgrade_credit")
                    .replace("{amount}", formatCurrency(credit.remainingValue))
                    .replace("{days}", String(credit.creditDays))}
                </p>
              )}
              <p className="text-sm text-slate-600">{t("plan_new_expiry").replace("{date}", formatValidUntil(newExpiry))}</p>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-600">{t("plan_total")}</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(price)}</p>
              </div>
              {/* D14: server tự hủy đơn chờ cũ khi tạo đơn mới. */}
              {me.pendingOrder && <p className="text-xs font-medium text-amber-800">{t("plan_replace_pending")}</p>}
              {!me.paymentReady && <p className="text-sm text-slate-500">{t("plan_payment_not_ready")}</p>}
              <Button
                type="button"
                className="h-12 w-full"
                disabled={!me.paymentReady || create.isPending}
                onClick={() => create.mutate(choice)}
              >
                {t("plan_create_order_short")}
              </Button>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
