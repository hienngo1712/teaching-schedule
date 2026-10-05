"use client"

import { useTranslation } from "@/components/providers/LanguageProvider"
import type { RouterOutputs } from "@/lib/trpc"
import { PLAN_LABEL, formatValidUntil } from "@/lib/plans"

type Me = RouterOutputs["plan"]["me"]

// Thay tiêu đề trang: gói đang dùng + hạn nổi bật ở đầu, thẻ so sánh gói không phải chứa nữa.
export function CurrentPlanSummary({ me }: { me: Me }) {
  const { t } = useTranslation()
  const count = String(me.activeStudents)
  return (
    <div data-testid="plan-current" className="rounded-xl border-l-4 border-primary bg-primary/[0.06] px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground md:text-[28px]">
          {t("plan_current_title").replace("{plan}", PLAN_LABEL[me.plan])}
        </h1>
        {me.source === "trial" && (
          <span className="rounded-full bg-amber-100 px-2.5 text-xs font-medium leading-6 text-amber-800">{t("plan_source_trial")}</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700 md:text-base">
        {me.expiresAt
          ? t("plan_valid_until").replace("{date}", formatValidUntil(new Date(me.expiresAt))).replace("{count}", count)
          : t("plan_active_now").replace("{count}", count)}
      </p>
    </div>
  )
}
