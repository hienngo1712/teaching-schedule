"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PLANS, PLAN_LABEL, formatValidUntil, type Plan } from "@/lib/plans"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

export function SetPlanDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<Plan>("pro")
  const [lastDay, setLastDay] = useState("")
  const [note, setNote] = useState("")
  const mut = trpc.admin.setPlan.useMutation({
    onSuccess: () => {
      toast.success(t("admin_plan_set"))
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })
  // setPlan không đụng trialEndsAt: đặt gói thấp hơn khi trial còn hạn vẫn hiện Pro tới hết trial.
  const trialUntil =
    user.trialEndsAt && new Date(user.trialEndsAt) > new Date() ? formatValidUntil(new Date(user.trialEndsAt)) : null
  const canSubmit = note.trim() !== "" && (plan === "standard" || lastDay !== "")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`${t("admin_set_plan")} · ${user.username}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="admin-plan">{t("admin_col_plan")}</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
              <SelectTrigger id="admin-plan" className="h-11 md:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {plan !== "standard" && (
            <div className="space-y-2">
              <Label htmlFor="admin-last-day">{t("admin_last_day")}</Label>
              <Input id="admin-last-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="h-11 md:h-10" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="admin-note">
              {t("admin_note")} <span className="text-red-500">*</span>
            </Label>
            <Textarea id="admin-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {trialUntil && <p className="text-xs text-amber-800">{t("admin_trial_note").replace("{date}", trialUntil)}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 md:h-10"
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate({ userId: user.id, plan, lastDay: plan === "standard" ? undefined : lastDay, note })}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
