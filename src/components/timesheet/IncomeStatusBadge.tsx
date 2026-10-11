"use client"

import { AlertCircle, CheckCircle2, CircleDollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Cùng 3 nhóm màu với TuitionStatusBadge (spec AM §3): chưa nhận = đỏ nợ, một phần = màu nhấn, đủ = xanh lá.
const DEBT = "whitespace-nowrap border-none bg-debt-soft text-debt hover:bg-debt-soft"
const IN_PROGRESS = "whitespace-nowrap border-none bg-primary/[0.08] text-primary hover:bg-primary/[0.08]"
const DONE = "whitespace-nowrap border-none bg-success-soft text-success hover:bg-success-soft"

export function IncomeStatusBadge({ status }: { status: "none" | "unpaid" | "partial" | "paid" }) {
  const { t } = useTranslation()
  if (status === "paid")
    return (
      <Badge className={DONE}>
        <CheckCircle2 className="mr-1 size-3" /> {t("income_status_paid")}
      </Badge>
    )
  if (status === "partial")
    return (
      <Badge className={IN_PROGRESS}>
        <CircleDollarSign className="mr-1 size-3" /> {t("income_status_partial")}
      </Badge>
    )
  if (status === "unpaid")
    return (
      <Badge className={DEBT}>
        <AlertCircle className="mr-1 size-3" /> {t("income_status_unpaid")}
      </Badge>
    )
  return null
}
