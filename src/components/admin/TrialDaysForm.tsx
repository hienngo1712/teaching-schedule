"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { trialDaysSchema } from "@/lib/schemas/plan"
import { dateTimeVn } from "./admin-format"

type Row = RouterOutputs["admin"]["trialSettings"]["history"][number]

export function TrialDaysForm() {
  const { t } = useTranslation()
  const query = trpc.admin.trialSettings.useQuery()
  const days = query.data?.days

  const change = (r: Row) =>
    r.previousDays === null
      ? t("admin_trial_initial").replace("{n}", String(r.days))
      : t("admin_trial_change").replace("{old}", String(r.previousDays)).replace("{new}", String(r.days))

  const columns: Column<Row>[] = [
    { header: t("admin_price_time"), cell: (r) => dateTimeVn(r.createdAt) },
    { header: t("admin_trial_days"), cell: change },
    { header: t("admin_price_changed_by"), cell: (r) => r.changedBy },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">{t("admin_trial_default")}</h2>
      {days !== undefined ? (
        // key theo số hiện hành: Lưu xong hoặc CONFLICT nạp số mới thì ô nhập khởi tạo lại.
        <TrialInput key={days} current={days} />
      ) : (
        query.isPending && <Skeleton className="h-32 w-full rounded-xl" />
      )}
      <h3 className="text-sm font-semibold text-foreground">{t("admin_trial_history")}</h3>
      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.history ?? []}
        getKey={(r) => r.id}
        columns={columns}
        emptyText={t("admin_trial_no_history")}
        renderCard={(r) => (
          <div data-testid="trial-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
            <p className="font-medium text-foreground">{change(r)}</p>
            <p className="text-xs text-slate-500">
              {r.changedBy} · {dateTimeVn(r.createdAt)}
            </p>
          </div>
        )}
      />
    </section>
  )
}

function TrialInput({ current }: { current: number }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [days, setDays] = useState<number | undefined>(current)
  const [confirming, setConfirming] = useState(false)
  const update = trpc.admin.updateTrialDays.useMutation({
    onSuccess: () => {
      toast.success(t("admin_trial_saved"))
      setConfirming(false)
    },
    onError: (e) => {
      toast.error(e.message)
      setConfirming(false)
      if (e.data?.code === "CONFLICT") void utils.admin.trialSettings.invalidate()
    },
  })

  const invalid = !trialDaysSchema.safeParse(days).success
  const canSave = !invalid && days !== current && !update.isPending

  return (
    <div data-testid="trial-days-form" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <p className="text-sm text-slate-600">{t("admin_trial_days")}</p>
      <CurrencyInput aria-label={t("admin_trial_days")} value={days} onChange={setDays} className="h-11 md:h-10 md:max-w-40" />
      {invalid && <p className="text-xs text-destructive">{t("admin_trial_err_range")}</p>}
      <p className="text-xs text-slate-500">{t("admin_trial_default_note")}</p>
      <Button type="button" className="h-12 w-full md:w-auto" disabled={!canSave} onClick={() => setConfirming(true)}>
        {t("admin_trial_save")}
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent data-testid="trial-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_trial_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {`${t("admin_trial_change").replace("{old}", String(current)).replace("{new}", String(days ?? 0))}. ${t("admin_trial_default_note")}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10" disabled={update.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 md:h-10"
              disabled={update.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (days !== undefined) update.mutate({ days, expected: current })
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
