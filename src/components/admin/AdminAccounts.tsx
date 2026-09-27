"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PLAN_LABEL, formatValidUntil } from "@/lib/plans"
import { SetPlanDialog } from "./SetPlanDialog"
import { TrialDaysDialog } from "./TrialDaysDialog"
import { SOURCE_KEY, dateOrDash } from "./admin-format"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

export function AdminAccounts() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [setPlanFor, setSetPlanFor] = useState<UserRow | null>(null)
  const [trialFor, setTrialFor] = useState<UserRow | null>(null)

  const planCell = (u: UserRow) => `${PLAN_LABEL[u.plan]} · ${t(SOURCE_KEY[u.source])}`
  const expiry = (u: UserRow) => (u.expiresAt ? formatValidUntil(new Date(u.expiresAt)) : "-")
  const setPlanButton = (u: UserRow) => (
    <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setSetPlanFor(u)}>
      {t("admin_set_plan")}
    </Button>
  )
  const actions = (u: UserRow) => (
    <div className="flex flex-wrap gap-2">
      {setPlanButton(u)}
      {/* Admin không dùng gói nên không cần đặt dùng thử (spec L mục 15). */}
      {!u.isAdmin && (
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setTrialFor(u)}>
          {t("admin_set_trial")}
        </Button>
      )}
    </div>
  )

  const columns: Column<UserRow>[] = [
    { header: t("username"), cell: (u) => <span className="font-medium">{u.username}</span> },
    { header: t("full_name"), cell: (u) => u.fullName ?? "-" },
    { header: t("admin_col_created"), cell: (u) => dateOrDash(u.createdAt) },
    { header: t("admin_col_last_login"), cell: (u) => dateOrDash(u.lastLoginAt) },
    { header: t("admin_col_students"), cell: (u) => u.activeStudents, className: "text-right" },
    { header: t("admin_col_plan"), cell: planCell },
    { header: t("admin_col_expiry"), cell: expiry },
    { header: <span className="sr-only">{t("actions")}</span>, cell: actions },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_accounts_plans")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.users ?? []}
        getKey={(u) => u.id}
        columns={columns}
        emptyText="-"
        renderCard={(u) => (
          <div data-testid="admin-user-card" className="space-y-2 rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{u.username}</p>
                <p className="truncate text-sm text-slate-500">{u.fullName ?? "-"}</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-primary">{planCell(u)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {t("admin_col_expiry")}: {expiry(u)} · {t("admin_col_students")}: {u.activeStudents} · {t("admin_col_last_login")}: {dateOrDash(u.lastLoginAt)}
            </p>
            {actions(u)}
          </div>
        )}
      />

      {setPlanFor && <SetPlanDialog key={setPlanFor.id} user={setPlanFor} onClose={() => setSetPlanFor(null)} />}
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
    </div>
  )
}
