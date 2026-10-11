"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart, type ChartBar } from "@/components/admin/BarChart"
import { LockedSection } from "@/components/plan/LockedSection"
import { LockBadge } from "@/components/plan/LockBadge"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { trpc } from "@/lib/trpc"
import { PLAN_LABEL } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"

const TUITION = "bg-amber-400"
const PLACES = "bg-primary"

// Thu nhập 12 tháng gần nhất (spec AN §4, mẫu 10): cột chồng học phí đã thu (khi có nơi theo học sinh) + nơi dạy đã trả. Gói Pro.
export function Income12Card() {
  const { t } = useTranslation()
  const gate = useFeatureGate("income12m")
  const showTuition = usePlaceSummary().summary?.hasPerStudent !== false
  const query = trpc.income.last12.useQuery(undefined, { enabled: gate.allowed })

  const title = (
    <CardTitle className="flex items-center gap-2 text-base">
      {t("income_12m_title")}
      {gate.locked && <LockBadge plan={gate.requiredPlan} />}
    </CardTitle>
  )

  if (gate.locked) {
    return (
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardContent>
          <LockedSection plan={gate.requiredPlan} label={t("plan_available_in").replace("{plan}", PLAN_LABEL[gate.requiredPlan])} testId="income-12m-locked">
            <div className="flex h-32 items-end gap-2">
              {[40, 70, 55, 90, 65, 80].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-slate-200" style={{ height: `${h}%` }} />
              ))}
            </div>
          </LockedSection>
        </CardContent>
      </Card>
    )
  }

  const months = query.data ?? []
  const total = months.reduce((a, m) => a + (showTuition ? m.tuition : 0) + m.places, 0)
  const bars: ChartBar[] = months.map((m, i) => {
    const amount = (showTuition ? m.tuition : 0) + m.places
    return {
      key: `${m.year}-${m.month}`,
      label: `T${m.month}`,
      ariaLabel: `T${m.month}/${m.year}: ${formatCurrency(amount)}${showTuition ? ` (${t("income_12m_tuition")} ${formatCurrency(m.tuition)}, ${t("income_12m_places")} ${formatCurrency(m.places)})` : ""}`,
      // Tháng hiện tại đang dạy dở: cột nhạt.
      faded: i === months.length - 1,
      segments: [
        ...(showTuition ? [{ key: "tuition", value: m.tuition, className: TUITION }] : []),
        { key: "places", value: m.places, className: PLACES },
      ],
    }
  })

  return (
    <Card data-testid="income-12m">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 space-y-0">
        {title}
        {query.data && <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-700">{t("income_12m_total").replace("{amount}", formatCurrency(total))}</span>}
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <BarChart
            bars={bars}
            layout="stacked"
            formatMax={formatCurrency}
            emptyText={t("income_12m_empty")}
            testId="income-12m-chart"
            legend={[
              { key: "places", label: t("income_12m_places"), className: PLACES },
              ...(showTuition ? [{ key: "tuition", label: t("income_12m_tuition"), className: TUITION }] : []),
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}
