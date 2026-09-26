"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { FEATURE_LABEL_KEY } from "./feature-labels"
import {
  PLANS,
  PLAN_LABEL,
  PLAN_PRICES,
  STUDENT_LIMITS,
  TWO_YEAR_BONUS_MONTHS,
  featuresAddedIn,
  type PaidPlan,
  type Plan,
} from "@/lib/plans"
import { cn, formatCurrency } from "@/lib/utils"

// P11: desktop Standard → Plus → Pro (trái sang phải), mobile Pro → Plus → Standard (trên xuống).
const CARD_ORDER: Record<Plan, string> = {
  standard: "order-3 md:order-1",
  plus: "order-2",
  pro: "order-1 md:order-3",
}
const BELOW: Record<Plan, Plan | null> = { standard: null, plus: "standard", pro: "plus" }

type Props = { current: Plan; plusBlocked: boolean; onChoose: (plan: PaidPlan) => void }

export function PlanCompare({ current, plusBlocked, onChoose }: Props) {
  const { t } = useTranslation()
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t("plan_compare")}</h2>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:items-start md:gap-4 md:pt-2">
        {PLANS.map((plan) => {
          const pro = plan === "pro"
          const below = BELOW[plan]
          const limit = STUDENT_LIMITS[plan]
          return (
            <article
              key={plan}
              data-testid={`plan-card-${plan}`}
              className={cn(
                "flex flex-col gap-3 rounded-xl p-4 md:p-5",
                CARD_ORDER[plan],
                pro ? "border-2 border-primary bg-primary/[0.04] md:-mt-2 md:pb-7" : "border border-slate-200 bg-white"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{PLAN_LABEL[plan]}</h3>
                {pro && (
                  <span className="rounded-full bg-primary px-2 text-xs font-medium leading-5 text-primary-foreground">
                    {t("plan_recommended")}
                  </span>
                )}
                {current === plan && (
                  <span className="rounded-full border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-600">
                    {t("plan_in_use")}
                  </span>
                )}
              </div>

              {plan === "standard" ? (
                <p className="text-2xl font-semibold text-foreground">{t("plan_source_free")}</p>
              ) : (
                <div className="space-y-0.5 text-sm text-slate-600">
                  <p>
                    <span className="text-2xl font-semibold text-foreground">{formatCurrency(PLAN_PRICES[plan].month)}</span>
                    {t("plan_per_month")}
                  </p>
                  <p>
                    {formatCurrency(PLAN_PRICES[plan].year)}
                    {t("plan_per_year")} · {t("plan_save_2_months")}
                  </p>
                  <p>
                    {formatCurrency(PLAN_PRICES[plan]["2year"])}
                    {t("plan_per_2years")} · {t("plan_bonus_months").replace("{n}", String(TWO_YEAR_BONUS_MONTHS))}
                  </p>
                </div>
              )}

              {limit !== null && (
                <p className="text-sm font-medium text-foreground">{t("plan_student_limit").replace("{n}", String(limit))}</p>
              )}

              <ul className="space-y-1.5 text-sm text-slate-700">
                {below && <li className="font-medium">{t("plan_includes_below").replace("{plan}", PLAN_LABEL[below])}</li>}
                {featuresAddedIn(plan).map((id) => (
                  <li key={id} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{t(FEATURE_LABEL_KEY[id])}</span>
                  </li>
                ))}
              </ul>

              {plan !== "standard" && (
                <Button
                  type="button"
                  variant={pro ? "default" : "outline"}
                  className="mt-auto h-11 md:h-10"
                  disabled={plan === "plus" && plusBlocked}
                  onClick={() => onChoose(plan)}
                >
                  {t("plan_choose").replace("{plan}", PLAN_LABEL[plan])}
                </Button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
