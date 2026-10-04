"use client"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { dueNow, getRowStatus, isProvisional, type DisplayRow } from "@/lib/tuition-display"

type Item = DisplayRow & { debtMonths: number }

export function TuitionAmountCell({ item, month, className, amountClassName }: { item: Item; month: number; className?: string; amountClassName?: string }) {
  const { t } = useTranslation()
  const due = dueNow(item)
  const prevM = month === 1 ? 12 : month - 1
  const parts: string[] = []
  if (item.previousBalance > 0 && item.totalExpected > 0) {
    parts.push(
      item.debtMonths > 1
        ? t("debt_n_months").replace("{n}", String(item.debtMonths)).replace("{amount}", formatCurrency(item.previousBalance))
        : t("debt_prev_month").replace("{m}", String(prevM)).replace("{amount}", formatCurrency(item.previousBalance))
    )
  }
  if (isProvisional(item) && item.totalExpected > 0) {
    parts.push(t("month_provisional").replace("{m}", String(month)).replace("{amount}", formatCurrency(item.totalExpected)))
  } else if (parts.length > 0) {
    parts.push(t("month_fee_short").replace("{m}", String(month)).replace("{amount}", formatCurrency(item.totalExpected)))
  }
  const status = getRowStatus(item)
  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <span className={cn("whitespace-nowrap font-semibold tabular-nums", status === "unpaid" ? "text-debt" : due === 0 ? "text-muted-foreground" : "text-foreground", amountClassName)}>
        {formatCurrency(due)}
      </span>
      {parts.length > 0 && <span className="text-xs text-slate-500 tabular-nums">{parts.join(" · ")}</span>}
    </div>
  )
}
