"use client"

import { useState } from "react"
import { BadgeCheck, Clock, KeyRound, MoreHorizontal } from "lucide-react"
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
import { SOURCE_KEY, dateOrDash } from "./admin-format"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

const NOWRAP = "whitespace-nowrap"
const ITEM = "min-h-11 md:min-h-0"

export function AdminAccounts() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [setPlanFor, setSetPlanFor] = useState<UserRow | null>(null)
  const [trialFor, setTrialFor] = useState<UserRow | null>(null)
  const [resetFor, setResetFor] = useState<UserRow | null>(null)
  // Vài chục tài khoản, overview đã trả đủ → phân trang phía client (spec P Q19).
  const { paginatedData, currentPage, setCurrentPage, pageSize, setPageSize, totalItems, totalPages } = usePagination(
    query.data?.users,
    20
  )

  const planCell = (u: UserRow) => `${PLAN_LABEL[u.plan]} · ${t(SOURCE_KEY[u.source])}`
  const expiry = (u: UserRow) => (u.expiresAt ? formatValidUntil(new Date(u.expiresAt)) : "-")
  // Item chỉ đặt state, dialog render ngoài menu (cùng cách StudentList): menu đóng hẳn rồi dialog mới mở.
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
        {/* Admin không dùng gói/không reset được mật khẩu admin (spec L mục 15, spec N R3). */}
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const columns: Column<UserRow>[] = [
    { header: t("username"), cell: (u) => <span className="font-medium">{u.username}</span>, className: NOWRAP },
    { header: t("full_name"), cell: (u) => u.fullName ?? "-", className: "min-w-[8rem]" },
    { header: t("admin_col_created"), cell: (u) => dateOrDash(u.createdAt), className: NOWRAP },
    { header: t("admin_col_last_login"), cell: (u) => dateOrDash(u.lastLoginAt), className: NOWRAP },
    { header: t("admin_col_students"), cell: (u) => u.activeStudents, className: `${NOWRAP} text-right` },
    { header: t("admin_col_plan"), cell: planCell, className: NOWRAP },
    { header: t("admin_col_expiry"), cell: expiry, className: NOWRAP },
    { header: t("admin_col_actions"), cell: actionsMenu, className: `w-14 ${NOWRAP} text-right` },
  ]

  return (
    // pb-14: thanh phân trang fixed ở đáy không che dòng/thẻ cuối.
    <div className="space-y-6 pb-14">
      <PageHeader title={t("admin_accounts_plans")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={paginatedData}
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
              <div className="-mr-2 -mt-2 shrink-0">{actionsMenu(u)}</div>
            </div>
            <p className="text-sm font-medium text-primary">{planCell(u)}</p>
            <p className="text-xs text-slate-500">
              {t("admin_col_expiry")}: {expiry(u)} · {t("admin_col_students")}: {u.activeStudents} · {t("admin_col_last_login")}: {dateOrDash(u.lastLoginAt)}
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

      {setPlanFor && <SetPlanDialog key={setPlanFor.id} user={setPlanFor} onClose={() => setSetPlanFor(null)} />}
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
      {resetFor && <ResetPasswordDialog key={resetFor.id} user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  )
}
