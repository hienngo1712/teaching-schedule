"use client"

import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { NoticeStatus } from "@/lib/types/models"
import dayjs from "@/lib/dayjs"

interface TuitionNoticeBadgeProps {
  item: {
    noticeStatus: NoticeStatus
    noticeSentAt?: Date | string | null
  }
  className?: string
}

export function TuitionNoticeBadge({ item, className }: TuitionNoticeBadgeProps) {
  const { t } = useTranslation()

  if (item.noticeStatus === "none") return null

  if (item.noticeStatus === "sent") {
    const d = item.noticeSentAt ? dayjs(item.noticeSentAt).tz("Asia/Ho_Chi_Minh").format("D/M") : ""
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
