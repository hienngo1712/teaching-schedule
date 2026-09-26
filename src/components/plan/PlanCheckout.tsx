"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import {
  PERIODS,
  PLAN_LABEL,
  PLAN_PRICES,
  addDays,
  computeBonusMonths,
  computeNewExpiry,
  computeUpgradeCredit,
  formatValidUntil,
  orderBlockedUntil,
  type PaidPlan,
  type Period,
  type PlanFields,
} from "@/lib/plans"
import { cn, formatCurrency } from "@/lib/utils"

export type PlanChoice = { plan: PaidPlan; period: Period }
type Me = RouterOutputs["plan"]["me"]

type Props = { me: Me; fields: PlanFields; choice: PlanChoice; onChange: (c: PlanChoice) => void }

export function PlanCheckout({ me, fields, choice, onChange }: Props) {
  const { t } = useTranslation()
  const now = new Date()
  const blockedUntil = orderBlockedUntil(fields, "plus", now)
  // Xem trước: ưu đãi chốt lúc tạo đơn, ngày quy đổi tính lại lúc admin duyệt (server là chuẩn).
  const bonus = computeBonusMonths(fields, choice.plan, choice.period, now)
  const credit = choice.plan === "pro" ? computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, now) : null
  const newExpiry = addDays(computeNewExpiry(fields, choice.plan, choice.period, now, bonus), credit?.creditDays ?? 0)

  const create = trpc.plan.createOrder.useMutation({
    onSuccess: () => toast.success(t("plan_order_created")),
    onError: (e) => toast.error(e.message),
  })

  const periodLabel: Record<Period, string> = { month: t("month"), year: t("year"), "2year": t("plan_period_2year") }
  const toggle = (active: boolean) =>
    cn(
      "h-11 flex-1 rounded-lg border px-2 text-sm font-medium transition-colors disabled:opacity-50 md:h-10",
      active ? "border-primary bg-primary/[0.08] text-primary" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    )

  return (
    <section id="plan-checkout" data-testid="plan-checkout" className="space-y-4 rounded-xl border bg-white p-4 md:p-6">
      <h2 className="text-base font-semibold text-foreground">{t("plan_upgrade_title")}</h2>

      <div role="group" aria-label={t("admin_col_plan")} className="flex gap-2">
        {(["plus", "pro"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={choice.plan === p}
            disabled={p === "plus" && blockedUntil !== null}
            onClick={() => onChange({ ...choice, plan: p })}
            className={toggle(choice.plan === p)}
          >
            {PLAN_LABEL[p]}
          </button>
        ))}
      </div>
      {blockedUntil && (
        <p className="text-xs text-slate-500">{t("plan_downgrade_blocked").replace("{date}", formatValidUntil(blockedUntil))}</p>
      )}

      <div role="group" aria-label={t("admin_col_period")} className="flex gap-2">
        {PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={choice.period === p} onClick={() => onChange({ ...choice, period: p })} className={toggle(choice.period === p)}>
            {periodLabel[p]}
          </button>
        ))}
      </div>

      <div className="space-y-1 text-sm text-slate-600">
        <p className="text-lg font-semibold text-foreground">
          {t("plan_amount").replace("{amount}", formatCurrency(PLAN_PRICES[choice.plan][choice.period]))}
        </p>
        {bonus > 0 && <p className="font-medium text-primary">{t("plan_bonus_months").replace("{n}", String(bonus))}</p>}
        {credit && credit.creditDays > 0 && (
          <p>
            {t("plan_upgrade_credit")
              .replace("{amount}", formatCurrency(credit.remainingValue))
              .replace("{days}", String(credit.creditDays))}
          </p>
        )}
        <p>{t("plan_new_expiry").replace("{date}", formatValidUntil(newExpiry))}</p>
      </div>

      {!me.paymentReady && <p className="text-sm text-slate-500">{t("plan_payment_not_ready")}</p>}
      <Button
        type="button"
        className="h-11 w-full md:h-10 md:w-auto"
        disabled={!me.paymentReady || create.isPending}
        onClick={() => create.mutate(choice)}
      >
        {t("plan_create_order")}
      </Button>
    </section>
  )
}
