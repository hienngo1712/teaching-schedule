"use client"

import { useState } from "react"
import { BadgeCheck, Clock, KeyRound, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePagination } from "@/hooks/usePagination"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PLAN_LABEL, formatValidUntil } from "@/lib/plans"
import { SetPlanDialog } from "./SetPlanDialog"
import { TrialDaysDialog } from "./TrialDaysDialog"
import { ResetPasswordDialog } from "./ResetPasswordDialog"
import { DeleteAccountDialog } from "./DeleteAccountDialog"
import { SOURCE_KEY, dateOrDash } from "./admin-format"
import { cn } from "@/lib/utils"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]
type DeletedUserRow = NonNullable<RouterOutputs["admin"]["deletedUsers"]>[number]

const NOWRAP = "whitespace-nowrap"
const ITEM = "min-h-11 md:min-h-0"

export function AdminAccounts() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const query = trpc.admin.overview.useQuery()
  const deletedQuery = trpc.admin.deletedUsers.useQuery()

  const [tab, setTab] = useState<"active" | "deleted">("active")
  const [setPlanFor, setSetPlanFor] = useState<UserRow | null>(null)
  const [trialFor, setTrialFor] = useState<UserRow | null>(null)
  const [resetFor, setResetFor] = useState<UserRow | null>(null)
  const [deleteFor, setDeleteFor] = useState<UserRow | null>(null)

  const restore = trpc.admin.restoreUser.useMutation({
    onSuccess: (_, v) => {
      const u = deletedQuery.data?.find((d) => d.id === v.userId)
      toast.success(t("admin_account_restored").replace("{username}", u?.username ?? ""))
      void utils.admin.overview.invalidate()
      void utils.admin.deletedUsers.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  // Phân trang phía client cho tab active (spec P Q19).
  const { paginatedData, currentPage, setCurrentPage, pageSize, setPageSize, totalItems, totalPages } = usePagination(
    query.data?.users,
    20
  )

  const planCell = (u: UserRow) => `${PLAN_LABEL[u.plan]} · ${t(SOURCE_KEY[u.source])}`
  const expiry = (u: UserRow) => (u.expiresAt ? formatValidUntil(new Date(u.expiresAt)) : "-")

  const actionsMenu = (u: UserRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="admin-user-actions"
          aria-label={`${t("actions")} ${u.username}`}
          className="size-11 md:size-9"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className={ITEM} onSelect={() => setSetPlanFor(u)}>
          <BadgeCheck className="mr-2 size-4" />
          {t("admin_set_plan")}
        </DropdownMenuItem>
        {!u.isAdmin && (
          <>
            <DropdownMenuItem className={ITEM} onSelect={() => setTrialFor(u)}>
              <Clock className="mr-2 size-4" />
              {t("admin_set_trial")}
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} onSelect={() => setResetFor(u)}>
              <KeyRound className="mr-2 size-4" />
              {t("admin_reset_password")}
            </DropdownMenuItem>
            <DropdownMenuItem className={`${ITEM} text-red-600 focus:text-red-700`} onSelect={() => setDeleteFor(u)}>
              <Trash2 className="mr-2 size-4" />
              {t("admin_delete_account")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const activeColumns: Column<UserRow>[] = [
    { header: t("username"), cell: (u) => <span className="font-medium">{u.username}</span>, className: NOWRAP },
    { header: t("full_name"), cell: (u) => u.fullName ?? "-", className: "min-w-[8rem]" },
    { header: t("admin_col_created"), cell: (u) => dateOrDash(u.createdAt), className: NOWRAP },
    { header: t("admin_col_last_login"), cell: (u) => dateOrDash(u.lastLoginAt), className: NOWRAP },
    { header: t("admin_col_students"), cell: (u) => u.activeStudents, className: `${NOWRAP} text-right` },
    { header: t("admin_col_plan"), cell: planCell, className: NOWRAP },
    { header: t("admin_col_expiry"), cell: expiry, className: NOWRAP },
    { header: t("admin_col_actions"), cell: actionsMenu, className: `w-14 ${NOWRAP} text-right` },
  ]

  const deletedColumns: Column<DeletedUserRow>[] = [
    { header: t("username"), cell: (d) => <span className="font-medium">{d.username}</span>, className: NOWRAP },
    { header: t("full_name"), cell: (d) => d.fullName ?? "-", className: "min-w-[8rem]" },
    { header: t("admin_col_deleted_at"), cell: (d) => dateOrDash(d.deletedAt), className: NOWRAP },
    { header: t("admin_col_deleted_by"), cell: (d) => d.deletedBy ?? "-", className: NOWRAP },
    {
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (d) => (
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          data-testid="admin-restore-user"
          aria-label={`${t("restore")} ${d.username}`}
          disabled={restore.isPending}
          onClick={() => restore.mutate({ userId: d.id })}
        >
          <RotateCcw className="mr-2 size-4" />
          {t("restore")}
        </Button>
      ),
      className: `w-32 ${NOWRAP} text-right`,
    },
  ]

  return (
    <div className="space-y-6 pb-14">
      <PageHeader title={t("admin_accounts_plans")} />

      <div role="tablist" aria-label={t("admin_accounts_plans")} className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          onClick={() => setTab("active")}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-9",
            tab === "active"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          {t("admin_tab_active")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "deleted"}
          onClick={() => setTab("deleted")}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-9",
            tab === "deleted"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          {t("admin_tab_deleted").replace("{count}", String(deletedQuery.data?.length ?? 0))}
        </button>
      </div>

      {tab === "active" ? (
        <>
          <ResponsiveList
            isLoading={query.isPending}
            isError={query.isError}
            onRetry={() => query.refetch()}
            errorText={t("load_error")}
            retryText={t("retry")}
            items={paginatedData}
            getKey={(u) => u.id}
            columns={activeColumns}
            emptyText="-"
            renderCard={(u) => (
              <div data-testid="admin-user-card" className="space-y-2 rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{u.username}</p>
                    <p className="truncate text-sm text-slate-500">{u.fullName ?? "-"}</p>
                  </div>
                  <div className="-mr-2 -mt-2 shrink-0">{actionsMenu(u)}</div>
                </div>
                <p className="text-sm font-medium text-primary">{planCell(u)}</p>
                <p className="text-xs text-slate-500">
                  {t("admin_col_expiry")}: {expiry(u)} · {t("admin_col_students")}: {u.activeStudents} ·{" "}
                  {t("admin_col_last_login")}: {dateOrDash(u.lastLoginAt)}
                </p>
              </div>
            )}
          />

          {totalItems > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCurrentPage(1)
              }}
              totalItems={totalItems}
            />
          )}
        </>
      ) : (
        <ResponsiveList
          isLoading={deletedQuery.isPending}
          isError={deletedQuery.isError}
          onRetry={() => deletedQuery.refetch()}
          errorText={t("load_error")}
          retryText={t("retry")}
          items={deletedQuery.data ?? []}
          getKey={(d) => d.id}
          columns={deletedColumns}
          emptyText={t("admin_no_deleted")}
          renderCard={(d) => (
            <div
              data-testid="admin-deleted-user-card"
              className="flex items-start justify-between gap-3 rounded-lg border bg-white p-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-foreground">{d.username}</p>
                <p className="truncate text-sm text-slate-500">{d.fullName ?? "-"}</p>
                <p className="text-xs text-slate-500">
                  {t("admin_col_deleted_at")}: {dateOrDash(d.deletedAt)} · {t("admin_col_deleted_by")}:{" "}
                  {d.deletedBy ?? "-"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                data-testid="admin-restore-user"
                aria-label={`${t("restore")} ${d.username}`}
                disabled={restore.isPending}
                onClick={() => restore.mutate({ userId: d.id })}
              >
                <RotateCcw className="mr-2 size-4" />
                {t("restore")}
              </Button>
            </div>
          )}
        />
      )}

      {setPlanFor && <SetPlanDialog key={setPlanFor.id} user={setPlanFor} onClose={() => setSetPlanFor(null)} />}
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
      {resetFor && <ResetPasswordDialog key={resetFor.id} user={resetFor} onClose={() => setResetFor(null)} />}
      {deleteFor && (
        <DeleteAccountDialog key={deleteFor.id} user={deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)} />
      )}
    </div>
  )
}
