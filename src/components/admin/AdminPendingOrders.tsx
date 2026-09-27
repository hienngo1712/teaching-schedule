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
import { formatValidUntil, planLabel } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"
import { dateOrDash, dateTimeVn, periodKey } from "./admin-format"

type PendingRow = RouterOutputs["admin"]["overview"]["pendingOrders"][number]

export function AdminPendingOrders() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [confirm, setConfirm] = useState<PendingRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null)

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

  const columns: Column<PendingRow>[] = [
    { header: t("username"), cell: (o) => <span className="font-medium">{o.username}</span> },
    { header: t("admin_col_plan"), cell: (o) => planLabel(o.plan) },
    { header: t("admin_col_period"), cell: (o) => t(periodKey(o.period)) },
    { header: t("payment_amount"), cell: (o) => formatCurrency(o.amount), className: "whitespace-nowrap text-right" },
    { header: t("admin_col_code"), cell: (o) => <span className="font-mono">{o.code}</span> },
    {
      header: t("admin_col_created"),
      cell: (o) => (
        <div className="whitespace-nowrap">
          <div>{dateOrDash(o.createdAt)}</div>
          <div className="text-xs text-slate-500">{t("admin_order_expires").replace("{date}", dateTimeVn(o.expiresAt))}</div>
        </div>
      ),
    },
    { header: <span className="sr-only">{t("actions")}</span>, cell: orderActions },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_pending_orders")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.pendingOrders ?? []}
        getKey={(o) => o.id}
        columns={columns}
        emptyText={t("admin_no_pending")}
        renderCard={(o) => (
          <div data-testid="pending-order-card" className="space-y-2 rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{o.username}</p>
                <p className="text-sm text-slate-500">
                  {planLabel(o.plan)} · {t(periodKey(o.period))} · {formatCurrency(o.amount)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm">{o.code}</span>
            </div>
            <p className="text-xs text-slate-500">{dateOrDash(o.createdAt)} · {t("admin_order_expires").replace("{date}", dateTimeVn(o.expiresAt))}</p>
            {orderActions(o)}
          </div>
        )}
      />

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
    </div>
  )
}
