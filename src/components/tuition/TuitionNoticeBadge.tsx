"use client"

import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { NoticeStatus } from "@/lib/types/models"
import dayjs from "@/lib/dayjs"
import { NOTICE_OVERDUE_DAYS, noticeAgeDays } from "@/lib/tuition-display"

interface TuitionNoticeBadgeProps {
  item: {
    noticeStatus: NoticeStatus
    noticeSentAt?: Date | string | null
    due?: number
  }
  className?: string
}

export function TuitionNoticeBadge({ item, className }: TuitionNoticeBadgeProps) {
  const { t } = useTranslation()

  if (item.noticeStatus === "none") return null

  if (item.noticeStatus === "sent") {
    const d = item.noticeSentAt ? dayjs(item.noticeSentAt).tz("Asia/Ho_Chi_Minh").format("D/M") : ""
    const hasDue = item.due !== undefined && item.due > 0
    if (hasDue && item.noticeSentAt) {
      const age = noticeAgeDays(item.noticeSentAt)
      const isOverdue = age >= NOTICE_OVERDUE_DAYS
      const label = t("notice_sent_age").replace("{d}", d).replace("{n}", String(age))
      const colorClass = isOverdue ? "bg-amber-50 text-amber-700 hover:bg-amber-50" : "bg-slate-100 text-slate-700 hover:bg-slate-100"
      return (
        <Badge
          variant="outline"
          className={`border-none ${colorClass} text-xs font-normal ${className ?? ""}`}
        >
          {label}
        </Badge>
      )
    }

    const label = t("notice_sent_on").replace("{d}", d)
    return (
      <Badge
        variant="outline"
        className={`border-none bg-emerald-50 text-emerald-700 text-xs font-normal hover:bg-emerald-50 ${className ?? ""}`}
      >
        {label}
      </Badge>
    )
  }

  if (item.noticeStatus === "changed") {
    return (
      <Badge
        variant="outline"
        className={`border-none bg-amber-50 text-amber-700 text-xs font-normal hover:bg-amber-50 ${className ?? ""}`}
      >
        {t("notice_changed")}
      </Badge>
    )
  }

  return null
}
