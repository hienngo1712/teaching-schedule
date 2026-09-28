"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { planLabel } from "@/lib/plans"
import { SOURCE_KEY, dateTimeVn } from "./admin-format"
import { SetPlanDialog } from "./SetPlanDialog"
import { TrialDaysDialog } from "./TrialDaysDialog"

type OverviewUser = RouterOutputs["admin"]["overview"]["users"][number]
type Row = RouterOutputs["admin"]["newAccounts"]["items"][number]

// Báo tài khoản mới, không chặn sử dụng (spec K K14). Dialog dùng lại dòng user của admin.overview (spec K R3).
export function NewAccounts({ users }: { users: OverviewUser[] }) {
  const { t } = useTranslation()
  const query = trpc.admin.newAccounts.useQuery()
  const mark = trpc.admin.markAccountsSeen.useMutation({
    onSuccess: () => toast.success(t("admin_new_accounts_marked")),
    onError: (e) => toast.error(e.message),
  })
  const [planFor, setPlanFor] = useState<OverviewUser | null>(null)
  const [trialFor, setTrialFor] = useState<OverviewUser | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const total = query.data?.total ?? 0
  const userOf = (r: Row) => users.find((u) => u.id === r.id) ?? null
  const planText = (r: Row) => `${planLabel(r.plan)} · ${t(SOURCE_KEY[r.source])}`

  const actions = (r: Row) => {
    const u = userOf(r)
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-11 md:h-9" onClick={() => mark.mutate({ userIds: [r.id] })} disabled={mark.isPending}>
          {t("admin_new_accounts_seen")}
        </Button>
        <Button size="sm" variant="outline" className="h-11 md:h-9" disabled={!u} onClick={() => u && setPlanFor(u)}>
          {t("admin_new_accounts_set_plan")}
        </Button>
        <Button size="sm" variant="outline" className="h-11 md:h-9" disabled={!u} onClick={() => u && setTrialFor(u)}>
          {t("admin_new_accounts_set_trial")}
        </Button>
      </div>
    )
  }

  const columns: Column<Row>[] = [
    { header: t("username"), cell: (r) => <span className="font-medium">{r.username}</span> },
    { header: t("full_name"), cell: (r) => r.fullName ?? "-" },
    { header: t("admin_new_accounts_registered"), cell: (r) => dateTimeVn(String(r.createdAt)) },
    { header: t("admin_new_accounts_current_plan"), cell: planText },
    { header: "", cell: actions },
  ]

  return (
    <section data-testid="new-accounts" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {t("admin_new_accounts")} {total > 0 && <span className="text-primary">({total})</span>}
          </h2>
          <p className="text-xs text-slate-500">{t("admin_new_accounts_hint")}</p>
        </div>
        {total > 0 && (
          <Button
            variant="outline"
            className="h-11 md:h-10"
            disabled={mark.isPending}
            onClick={() => (total > 1 ? setConfirmAll(true) : mark.mutate({ all: true }))}
          >
            {t("admin_new_accounts_seen_all")}
          </Button>
        )}
      </div>
      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.items ?? []}
        getKey={(r) => r.id}
        columns={columns}
        emptyText={t("admin_new_accounts_empty")}
        renderCard={(r) => (
          <div data-testid="new-account-card" className="space-y-2 rounded-lg border bg-white p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.username}</p>
              <p className="text-slate-500">{r.fullName ?? "-"}</p>
            </div>
            <p className="text-xs text-slate-500">
              {t("admin_new_accounts_registered")}: {dateTimeVn(String(r.createdAt))} · {planText(r)}
            </p>
            {actions(r)}
          </div>
        )}
      />

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_new_accounts_seen_all_confirm").replace("{n}", String(total))}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction className="h-11 md:h-10" onClick={() => mark.mutate({ all: true })}>
              {t("admin_new_accounts_seen_all")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {planFor && <SetPlanDialog key={planFor.id} user={planFor} onClose={() => setPlanFor(null)} />}
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
    </section>
  )
}
