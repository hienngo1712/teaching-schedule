"use client"

import { Clock } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PLAN_LABEL, type Plan } from "@/lib/plans"
import { cn } from "@/lib/utils"

// J4: Standard trung tính; Pro có viền cùng màu nền để cao bằng 2 kiểu có viền.
const STYLE: Record<Plan, string> = {
  standard: "border-slate-300 bg-white text-slate-600",
  plus: "border-primary bg-white text-primary",
  pro: "border-primary bg-primary text-primary-foreground",
}

export function CurrentPlanBadge() {
  const { t } = useTranslation()
  const { me } = usePlan()
  if (!me) return null
  // Q16: sidebar 232px không đủ chỗ cho "Pro · Dùng thử" → icon đồng hồ + nhãn đọc màn hình.
  const trialLabel = me.source === "trial" ? t("plan_badge_trial") : undefined
  return (
    <span
      data-testid="current-plan-badge"
      title={trialLabel}
      aria-label={trialLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 text-[10px] font-semibold leading-4",
        STYLE[me.plan]
      )}
    >
      {trialLabel && <Clock aria-hidden className="size-3" />}
      {PLAN_LABEL[me.plan]}
    </span>
  )
}
