"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PLAN_LABEL, formatValidUntil, isPeriod, planLabel } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { formatCurrency } from "@/lib/utils"
import { SetPlanDialog } from "./SetPlanDialog"

type Overview = RouterOutputs["admin"]["overview"]
type PendingRow = Overview["pendingOrders"][number]
type UserRow = Overview["users"][number]

const SOURCE_KEY = { trial: "plan_source_trial", paid: "plan_source_paid", free: "plan_source_free" } as const

export function AdminPanel() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [confirm, setConfirm] = useState<PendingRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null)
  const [setPlanFor, setSetPlanFor] = useState<UserRow | null>(null)

  const approve = trpc.admin.approveOrder.useMutation({
    onSuccess: () => {
      toast.success(t("admin_approved"))
      setConfirm(null)
    },
    onError: (e) => toast.error(e.message),
  })
  const reject = trpc.admin.rejectOrder.useMutation({
    onSuccess: () => {
      toast.success(t("admin_rejected"))
      setRejectTarget(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const date = (d: string | null) => (d ? formatVnDate(new Date(d)) : "-")
  const period = (p: string | null) =>
    !isPeriod(p) ? t("plan_order_by_admin") : p === "2year" ? t("plan_period_2year") : p === "month" ? t("month") : t("year")
  const planCell = (u: UserRow) => `${PLAN_LABEL[u.plan]} · ${t(SOURCE_KEY[u.source])}`
  const expiry = (u: UserRow) => (u.expiresAt ? formatValidUntil(new Date(u.expiresAt)) : "-")

  const orderActions = (o: PendingRow) => (
    <div className="flex gap-2">
      <Button
        type="button"
        className="h-11 md:h-9"
        onClick={() => (o.preview ? setConfirm(o) : toast.error(t("admin_cannot_approve")))}
      >
        {t("admin_approve")}
      </Button>
      <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setRejectTarget(o)}>
        {t("admin_reject")}
      </Button>
    </div>
  )

  const pendingColumns: Column<PendingRow>[] = [
    { header: t("username"), cell: (o) => <span className="font-medium">{o.username}</span> },
    { header: t("admin_col_plan"), cell: (o) => planLabel(o.plan) },
    { header: t("admin_col_period"), cell: (o) => period(o.period) },
    { header: t("payment_amount"), cell: (o) => formatCurrency(o.amount), className: "whitespace-nowrap text-right" },
    { header: t("admin_col_code"), cell: (o) => <span className="font-mono">{o.code}</span> },
    { header: t("admin_col_created"), cell: (o) => date(o.createdAt) },
    { header: <span className="sr-only">{t("actions")}</span>, cell: orderActions },
  ]

  const userColumns: Column<UserRow>[] = [
    { header: t("username"), cell: (u) => <span className="font-medium">{u.username}</span> },
    { header: t("full_name"), cell: (u) => u.fullName ?? "-" },
    { header: t("admin_col_created"), cell: (u) => date(u.createdAt) },
    { header: t("admin_col_last_login"), cell: (u) => date(u.lastLoginAt) },
    { header: t("admin_col_students"), cell: (u) => u.activeStudents, className: "text-right" },
    { header: t("admin_col_plan"), cell: planCell },
    { header: t("admin_col_expiry"), cell: expiry },
    {
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (u) => (
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setSetPlanFor(u)}>
          {t("admin_set_plan")}
        </Button>
      ),
    },
  ]

  const listProps = {
    isLoading: query.isPending,
    isError: query.isError,
    onRetry: () => query.refetch(),
    errorText: t("load_error"),
    retryText: t("retry"),
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_page")} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("admin_pending_orders")}</h2>
        <ResponsiveList
          {...listProps}
          items={query.data?.pendingOrders ?? []}
          getKey={(o) => o.id}
          columns={pendingColumns}
          emptyText={t("admin_no_pending")}
          renderCard={(o) => (
            <div data-testid="pending-order-card" className="space-y-2 rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{o.username}</p>
                  <p className="text-sm text-slate-500">
                    {planLabel(o.plan)} · {period(o.period)} · {formatCurrency(o.amount)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm">{o.code}</span>
              </div>
              <p className="text-xs text-slate-500">{date(o.createdAt)}</p>
              {orderActions(o)}
            </div>
          )}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("admin_accounts")}</h2>
        <ResponsiveList
          {...listProps}
          items={query.data?.users ?? []}
          getKey={(u) => u.id}
          columns={userColumns}
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
                {t("admin_col_expiry")}: {expiry(u)} · {t("admin_col_students")}: {u.activeStudents} · {t("admin_col_last_login")}: {date(u.lastLoginAt)}
              </p>
              <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setSetPlanFor(u)}>
                {t("admin_set_plan")}
              </Button>
            </div>
          )}
        />
      </section>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_approve")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.preview &&
                `${t("admin_approve_confirm")
                  .replace("{code}", confirm.code ?? "")
                  .replace("{plan}", planLabel(confirm.plan))
                  .replace("{date}", formatValidUntil(new Date(confirm.preview.grantedUntil)))}${
                  confirm.preview.creditDays > 0
                    ? ` ${t("admin_credit_days").replace("{days}", String(confirm.preview.creditDays))}`
                    : ""
                }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approve.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={approve.isPending}
              onClick={(e) => {
                // Giữ hộp mở tới khi mutation xong (onSuccess tự đóng).
                e.preventDefault()
                if (confirm) approve.mutate({ id: confirm.id })
              }}
            >
              {t("admin_approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_reject")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin_reject_confirm").replace("{code}", rejectTarget?.code ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reject.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={reject.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (rejectTarget) reject.mutate({ id: rejectTarget.id })
              }}
            >
              {t("admin_reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {setPlanFor && <SetPlanDialog key={setPlanFor.id} user={setPlanFor} onClose={() => setSetPlanFor(null)} />}
    </div>
  )
}
