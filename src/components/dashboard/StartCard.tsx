"use client"

import Link from "next/link"
import { CheckCircle2, Circle, ExternalLink, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type vi from "@/language/vi.json"
import { TourButton } from "@/components/tour/TourButton"
import type { TourId } from "@/lib/tours"

type StepKey = "student" | "session" | "attendance" | "payment" | "bank"

const START_STEPS: { key: StepKey; label: keyof typeof vi; hint?: keyof typeof vi; href: string; guideId: string; tour: TourId }[] = [
  { key: "student", label: "start_step_student", href: "/students", guideId: "hoc-sinh", tour: "student" },
  { key: "session", label: "start_step_session", hint: "start_step_session_hint", href: "/calendar", guideId: "lich-day", tour: "session" },
  { key: "attendance", label: "start_step_attendance", href: "/calendar", guideId: "diem-danh", tour: "attendance" },
  { key: "payment", label: "start_step_payment", href: "/tuition", guideId: "hoc-phi", tour: "tuition" },
  { key: "bank", label: "start_step_bank", hint: "start_step_bank_hint", href: "/settings", guideId: "tai-khoan-ngan-hang", tour: "bank" },
]

export function StartCard() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const { data } = trpc.onboarding.status.useQuery()
  const dismiss = trpc.onboarding.dismiss.useMutation({
    onSuccess: () => utils.onboarding.status.setData(undefined, (old) => (old ? { ...old, dismissed: true } : old)),
  })

  if (!data || data.dismissed) return null
  const done = START_STEPS.filter((s) => data.steps[s.key]).length
  if (done === START_STEPS.length) return null

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{t("start_title")}</p>
            <p className="text-sm text-slate-500">
              {t("start_progress").replace("{n}", String(done)).replace("{total}", String(START_STEPS.length))}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:size-10"
            aria-label={t("start_dismiss")}
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-primary" style={{ width: `${(done / START_STEPS.length) * 100}%` }} />
        </div>
        <ul className="divide-y">
          {START_STEPS.map((s) => {
            const ok = data.steps[s.key]
            return (
              <li key={s.key} data-testid="start-step" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                {ok ? (
                  <CheckCircle2 data-testid="start-step-done" className="size-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-slate-300" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className={ok ? "text-sm text-slate-400 line-through" : "text-sm font-medium text-slate-900"}>{t(s.label)}</p>
                  {s.hint && !ok && <p className="text-xs text-slate-500">{t(s.hint)}</p>}
                </div>
                <a
                  href={`/guide#${s.guideId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-xs text-primary underline underline-offset-2"
                >
                  {t("start_guide")}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
                <TourButton id={s.tour} />
                {!ok && (
                  <Button asChild variant="outline" size="sm" className="h-11 md:h-9">
                    <Link href={s.href}>{t("start_open")}</Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
