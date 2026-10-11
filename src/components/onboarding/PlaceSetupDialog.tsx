"use client"

import { useState } from "react"
import { Check, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PlanCompare } from "@/components/plan/PlanCompare"
import { PlanPurchaseDialog } from "@/components/plan/PlanPurchaseDialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { usePlan } from "@/hooks/usePlan"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { orderBlockedUntil, type PaidPlan } from "@/lib/plans"

type Kind = "home" | "tutor" | "center"
const KINDS: Kind[] = ["home", "tutor", "center"]

// Popup đăng ký (spec AL §5, mẫu 01–02): chưa có nơi dạy → bước 1 chọn nơi, bước 2 chọn gói. Không có nút đóng.
export function PlaceSetupDialog() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const { summary } = usePlaceSummary()
  const { me, fields } = usePlan()
  const [step, setStep] = useState<"places" | "plan" | "done">("places")
  const [picked, setPicked] = useState<Record<Kind, boolean>>({ home: false, tutor: false, center: false })
  const [centers, setCenters] = useState<string[]>([""])
  const [purchasePlan, setPurchasePlan] = useState<PaidPlan | null>(null)

  const setup = trpc.place.setupInitial.useMutation({
    onSuccess: async () => {
      await utils.place.invalidate()
      setStep("plan")
    },
    onError: (e) => toast.error(e.message),
  })

  const needed = summary?.count === 0
  const open = (needed && step === "places") || step === "plan"

  const submit = () => {
    // Không tick gì vẫn cho Tiếp tục → tạo "Lớp tại nhà". Tên trung tâm trống server đặt "Trung tâm".
    const nothing = !picked.home && !picked.tutor && !picked.center
    setup.mutate({ home: picked.home || nothing, tutor: picked.tutor, centers: picked.center ? centers : [] })
  }

  return (
    <>
      <Dialog open={open}>
        <DialogContent
          data-testid="place-setup-dialog"
          className="max-h-[100dvh] w-full max-w-none overflow-y-auto sm:max-h-[90vh] sm:max-w-lg md:max-w-4xl [&>button:last-child]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {step === "places" ? (
            <div className="mx-auto w-full max-w-lg space-y-5">
              <DialogHeader className="text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("setup_step").replace("{n}", "1")}</p>
                <DialogTitle className="text-xl">{t("setup_places_title")}</DialogTitle>
                <DialogDescription>{t("setup_places_desc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {KINDS.map((k) => (
                  <div key={k} className={cn("rounded-xl border p-4", picked[k] ? "border-primary bg-primary/[0.04]" : "border-slate-200 bg-white")}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={picked[k]}
                      onClick={() => setPicked((p) => ({ ...p, [k]: !p[k] }))}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                          picked[k] ? "border-primary bg-primary text-white" : "border-slate-300"
                        )}
                      >
                        {picked[k] && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{t(`place_kind_${k}`)}</span>
                        <span className="block text-sm text-slate-500">{t(`setup_${k}_desc`)}</span>
                      </span>
                    </button>
                    {k === "center" && picked.center && (
                      <div className="mt-3 space-y-2 pl-8">
                        {centers.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              value={c}
                              maxLength={100}
                              placeholder={t("setup_center_name")}
                              aria-label={t("setup_center_name")}
                              onChange={(e) => setCenters((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                              className="h-11 md:h-10"
                            />
                            {centers.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11 shrink-0 md:size-10"
                                aria-label={t("delete")}
                                onClick={() => setCenters((list) => list.filter((_, j) => j !== i))}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {centers.length < 10 && (
                          <Button type="button" variant="ghost" className="h-11 px-2 text-primary md:h-9" onClick={() => setCenters((l) => [...l, ""])}>
                            <Plus className="mr-1 size-4" />
                            {t("setup_add_center")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button className="h-11 w-full" disabled={setup.isPending} onClick={submit}>
                {setup.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("setup_continue")}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <DialogHeader className="text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("setup_step").replace("{n}", "2")}</p>
                <DialogTitle className="text-xl">{t("setup_plan_title")}</DialogTitle>
                <DialogDescription>{t("setup_plan_desc")}</DialogDescription>
              </DialogHeader>
              {me && fields && (
                <PlanCompare
                  me={me}
                  hideNewBadges
                  plusBlocked={orderBlockedUntil(fields, "plus", new Date()) !== null}
                  onChoose={(plan) => {
                    // Mua gói: đóng popup đăng ký, mở popup mua; đóng popup mua là về app (không quay lại bước 2).
                    setStep("done")
                    setPurchasePlan(plan)
                  }}
                />
              )}
              {/* < 768px: nút chính dính đáy popup (luôn thấy), thẻ gói cuộn phía trên. -bottom-6 bù padding p-6 của popup để sát đáy. */}
              <div className="sticky -bottom-6 -mx-6 -mb-6 border-t bg-background px-6 pb-6 pt-3 md:static md:m-0 md:border-0 md:p-0">
                <Button className="h-12 w-full text-base" onClick={() => setStep("done")}>
                  {t("setup_start_free")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {purchasePlan && me && fields && (
        <PlanPurchaseDialog open onOpenChange={(o) => !o && setPurchasePlan(null)} me={me} fields={fields} initialPlan={purchasePlan} />
      )}
    </>
  )
}
