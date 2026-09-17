"use client"

import { AlertCircle, BadgeCheck, CheckCircle2, CircleDollarSign, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getTuitionBadgeStatus, type TuitionStatusInput } from "@/lib/tuition-status"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Badge dùng chung cho trang Học phí và thẻ tóm tắt ở Báo cáo.
export function TuitionStatusBadge({ item }: { item: TuitionStatusInput }) {
  const { t } = useTranslation()

  switch (getTuitionBadgeStatus(item)) {
    case "overpaid":
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
          <CircleDollarSign className="size-3 mr-1" /> {t("overpaid")}
        </Badge>
      )
    case "settled_waived":
      return (
        <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border-none">
          <BadgeCheck className="size-3 mr-1" /> {t("settled_waived")}
        </Badge>
      )
    case "fully_paid":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
          <CheckCircle2 className="size-3 mr-1" /> {t("fully_paid")}
        </Badge>
      )
    case "paid_this_month":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
          <CheckCircle2 className="size-3 mr-1" /> {t("paid_this_month")}
        </Badge>
      )
    case "partial":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
          <Clock className="size-3 mr-1" /> {t("partial_paid")}
        </Badge>
      )
    case "unpaid":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">
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
