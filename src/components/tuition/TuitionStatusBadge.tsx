"use client"

import { AlertCircle, BadgeCheck, CheckCircle2, CircleDollarSign, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getTuitionBadgeStatus, type TuitionStatusInput } from "@/lib/tuition-status"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Chỉ 3 nhóm màu: nợ (đỏ nợ), đang dở (màu nhấn), đã xong (xanh lá). hover giữ nền vì badge không bấm được.
const DEBT = "border-none bg-debt-soft text-debt hover:bg-debt-soft"
const IN_PROGRESS = "border-none bg-primary/[0.08] text-primary hover:bg-primary/[0.08]"
const DONE = "border-none bg-success-soft text-success hover:bg-success-soft"

// Badge dùng chung cho trang Học phí và thẻ tóm tắt ở Báo cáo.
export function TuitionStatusBadge({ item }: { item: TuitionStatusInput }) {
  const { t } = useTranslation()

  switch (getTuitionBadgeStatus(item)) {
    case "overpaid":
      return (
        <Badge className={DONE}>
          <CircleDollarSign className="size-3 mr-1" /> {t("overpaid")}
        </Badge>
      )
    case "settled_waived":
      return (
        <Badge className={DONE}>
          <BadgeCheck className="size-3 mr-1" /> {t("settled_waived")}
        </Badge>
      )
    case "fully_paid":
      return (
        <Badge className={DONE}>
          <CheckCircle2 className="size-3 mr-1" /> {t("fully_paid")}
        </Badge>
      )
    case "paid_this_month":
      return (
        <Badge className={IN_PROGRESS}>
          <CheckCircle2 className="size-3 mr-1" /> {t("paid_this_month")}
        </Badge>
      )
    case "partial":
      return (
        <Badge className={IN_PROGRESS}>
          <Clock className="size-3 mr-1" /> {t("partial_paid")}
        </Badge>
      )
    case "unpaid":
      return (
        <Badge className={DEBT}>
          <AlertCircle className="size-3 mr-1" /> {t("unpaid")}
        </Badge>
      )
    case "no_sessions":
      return (
        <Badge variant="outline" className="text-slate-400 border-slate-200 font-normal">
          {t("no_sessions")}
        </Badge>
      )
  }
}
