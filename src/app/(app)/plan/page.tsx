"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/common/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PlanCompare } from "@/components/plan/PlanCompare"
import { PlanPurchaseDialog } from "@/components/plan/PlanPurchaseDialog"
import { PendingOrderCard } from "@/components/plan/PendingOrderCard"
import { isPeriod, orderBlockedUntil, planLabel, type PaidPlan } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { formatCurrency } from "@/lib/utils"

const STATUS_KEY = {
  pending: "plan_pending",
  approved: "plan_status_approved",
  rejected: "plan_status_rejected",
  cancelled: "plan_status_cancelled",
} as const

export default function PlanPage() {
  const { t } = useTranslation()
  const { me, fields } = usePlan()
  const router = useRouter()
  // Biến tên "query": tests/unit/next15-contract.test.ts cấm định danh tham số route trong page.tsx.
  const query = useSearchParams()
  const wantsBuy = query.get("buy") === "1"
  const loaded = me !== undefined
  const [purchasePlan, setPurchasePlan] = useState<PaidPlan | null>(null)

  useEffect(() => {
    // Q15: "Gia hạn ngay" dẫn tới /plan?buy=1 → tự mở popup Pro (kỳ Năm), bỏ param để tải lại không mở lại.
    if (!wantsBuy || !loaded) return
    setPurchasePlan("pro")
    router.replace("/plan")
  }, [wantsBuy, loaded, router])

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

      {me.pendingOrder && <PendingOrderCard order={me.pendingOrder} paymentReady={me.paymentReady} />}

      <PlanCompare me={me} plusBlocked={plusBlocked} onChoose={setPurchasePlan} />

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

      {/* Mount mỗi lần mở để lựa chọn về gói vừa bấm + kỳ Năm (P11). */}
      {purchasePlan && (
        <PlanPurchaseDialog
          open
          onOpenChange={(open) => {
            if (!open) setPurchasePlan(null)
          }}
          me={me}
          fields={fields}
          initialPlan={purchasePlan}
        />
      )}
    </div>
  )
}
