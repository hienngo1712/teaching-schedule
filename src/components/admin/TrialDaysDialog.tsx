"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { daysLeft, formatValidUntil, trialDaysOf, trialEndFor } from "@/lib/plans"
import { userTrialDaysSchema } from "@/lib/schemas/plan"
import { dateOrDash, dateTimeVn } from "./admin-format"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

// Xem trước bằng cùng hàm với server: hạn = đầu ngày VN của ngày tạo tài khoản + N ngày (spec L mục 15 T3).
export function TrialDaysDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  const createdAt = new Date(user.createdAt)
  const currentEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null
  const currentDays = trialDaysOf(createdAt, currentEnd)
  const [days, setDays] = useState<number | undefined>(currentDays ?? undefined)
  const changes = trpc.admin.userTrialChanges.useQuery({ userId: user.id })
  const mut = trpc.admin.setUserTrial.useMutation({
    onSuccess: () => {
      toast.success(t("admin_trial_set"))
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const now = new Date()
  const valid = userTrialDaysSchema.safeParse(days).success
  const newEnd = valid && days !== undefined ? trialEndFor(createdAt, days) : null
  const canSave = valid && days !== currentDays && !mut.isPending
  const change = (prev: number | null, next: number) =>
    t("admin_trial_change").replace("{old}", prev === null ? "-" : String(prev)).replace("{new}", String(next))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`${t("admin_set_trial")} · ${user.username}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            {t("admin_col_created")}: {dateOrDash(user.createdAt)}
          </p>
          <p className="text-slate-600">
            {currentDays !== null && currentEnd
              ? t("admin_trial_current").replace("{n}", String(currentDays)).replace("{date}", formatValidUntil(currentEnd))
              : t("admin_trial_none")}
          </p>
          <div className="space-y-2">
            <p className="font-medium text-foreground">{t("admin_trial_user_label")}</p>
            <CurrencyInput aria-label={t("admin_trial_user_label")} value={days} onChange={setDays} className="h-11 md:h-10" />
            {days !== undefined && !valid && <p className="text-xs text-destructive">{t("admin_trial_err_user_range")}</p>}
          </div>
          {valid && (
            <p data-testid="trial-preview" className="font-medium text-foreground">
              {newEnd === null
                ? t("admin_trial_off")
                : `${t("admin_trial_new_until").replace("{date}", formatValidUntil(newEnd))} · ${
                    newEnd > now ? t("admin_trial_days_left").replace("{n}", String(daysLeft(newEnd, now))) : t("admin_trial_expired")
                  }`}
            </p>
          )}
          {changes.data && changes.data.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin_trial_recent")}</p>
              <ul className="space-y-0.5 text-xs text-slate-500">
                {changes.data.map((c) => (
                  <li key={c.id}>{`${c.changedBy} · ${dateTimeVn(c.createdAt)} · ${change(c.previousDays, c.days)}`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 md:h-10"
            disabled={!canSave}
            onClick={() => days !== undefined && mut.mutate({ userId: user.id, days })}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
