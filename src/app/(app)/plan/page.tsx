"use client"

import { useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/common/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PlanCompare } from "@/components/plan/PlanCompare"
import { PlanCheckout, type PlanChoice } from "@/components/plan/PlanCheckout"
import { PendingOrderCard } from "@/components/plan/PendingOrderCard"
import { PLAN_LABEL, formatValidUntil, isPeriod, orderBlockedUntil, planLabel } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { formatCurrency } from "@/lib/utils"

const SOURCE_KEY = { trial: "plan_source_trial", paid: "plan_source_paid", free: "plan_source_free" } as const
const STATUS_KEY = {
  pending: "plan_pending",
  approved: "plan_status_approved",
  rejected: "plan_status_rejected",
  cancelled: "plan_status_cancelled",
} as const

export default function PlanPage() {
  const { t } = useTranslation()
  const { me, fields } = usePlan()
  // P11: luôn chọn sẵn Pro, kỳ Năm.
  const [choice, setChoice] = useState<PlanChoice>({ plan: "pro", period: "year" })

  if (!me || !fields) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t("my_plan")} />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const plusBlocked = orderBlockedUntil(fields, "plus", new Date()) !== null
  const periodText = (p: string | null) =>
    !isPeriod(p) ? t("plan_order_by_admin") : p === "2year" ? t("plan_period_2year") : p === "month" ? t("month") : t("year")

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("my_plan")} />

      <section data-testid="current-plan" className="rounded-xl border bg-white p-4 md:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("plan_current")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">{PLAN_LABEL[me.plan]}</h2>
          <span className="rounded-full border border-primary px-2 text-xs font-medium leading-5 text-primary">{t(SOURCE_KEY[me.source])}</span>
        </div>
        {me.expiresAt && (
          <p className="mt-2 text-sm text-slate-600">{t("plan_valid_until").replace("{date}", formatValidUntil(new Date(me.expiresAt)))}</p>
        )}
        <p className="mt-1 text-sm text-slate-600">
          {me.studentLimit === null
            ? t("plan_students_unlimited").replace("{count}", String(me.activeStudents))
            : t("plan_students_usage").replace("{count}", String(me.activeStudents)).replace("{limit}", String(me.studentLimit))}
        </p>
      </section>

      <PlanCompare
        current={me.plan}
        plusBlocked={plusBlocked}
        onChoose={(plan) => {
          setChoice((c) => ({ ...c, plan }))
          document.getElementById("plan-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}
      />

      {me.pendingOrder && <PendingOrderCard order={me.pendingOrder} paymentReady={me.paymentReady} />}
      <PlanCheckout me={me} fields={fields} choice={choice} onChange={setChoice} />

      <section data-testid="plan-history" className="space-y-2 rounded-xl border bg-white p-4 md:p-6">
        <h2 className="text-base font-semibold text-foreground">{t("plan_history")}</h2>
        {me.orders.length === 0 ? (
          <p className="text-sm text-slate-500">{t("plan_no_orders")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {me.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="text-slate-500">{formatVnDate(new Date(o.createdAt))}</span>
                <span className="font-medium text-foreground">
                  {planLabel(o.plan)} · {periodText(o.period)}
                </span>
                <span className="text-slate-600">{formatCurrency(o.amount)}</span>
                <span className="ml-auto text-slate-600">
                  {o.status in STATUS_KEY ? t(STATUS_KEY[o.status as keyof typeof STATUS_KEY]) : o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {me.isAdmin && (
        <Link href="/admin" data-testid="admin-link" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">
          {t("admin_link")}
        </Link>
      )}
    </div>
  )
}
