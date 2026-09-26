"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PLAN_LABEL, planBanner } from "@/lib/plans"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "plan-banner-dismissed"

export function PlanBanner() {
  const { t } = useTranslation()
  const { me, fields } = usePlan()
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  useEffect(() => {
    try {
      setDismissedKey(localStorage.getItem(DISMISS_KEY))
    } catch {
      // localStorage bị chặn (chế độ riêng tư): banner vẫn hiện, chỉ không nhớ đã đóng.
    }
  }, [])

  if (!me || !fields) return null
  const banner = planBanner(fields, new Date(), me.pendingOrder !== null)
  if (!banner || (banner.kind === "expired" && dismissedKey === banner.key)) return null

  const expired = banner.kind === "expired"
  const text = expired
    ? t("plan_expired").replace("{plan}", PLAN_LABEL[banner.plan])
    : t("plan_trial_ending").replace("{n}", String(banner.days))

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, banner.key)
    } catch {
      // Không lưu được thì chỉ ẩn trong phiên này.
    }
    setDismissedKey(banner.key)
  }

  return (
    <div
      role="status"
      data-testid="plan-banner"
      className={cn(
        "mb-4 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm",
        expired ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      <p className="min-w-0 flex-1">{text}</p>
      <Button asChild size="sm" variant="outline" className="h-11 bg-white md:h-9">
        <Link href="/plan">{t("plan_view_plans")}</Link>
      </Button>
      {expired && (
        <Button type="button" size="icon" variant="ghost" aria-label={t("plan_dismiss")} className="size-11 md:size-9" onClick={dismiss}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
