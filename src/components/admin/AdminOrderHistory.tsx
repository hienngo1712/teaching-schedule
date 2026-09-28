"use client"

import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { formatValidUntil, planLabel } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"
import { dateOrDash, periodKey } from "./admin-format"

type Row = RouterOutputs["admin"]["orderHistory"][number]

const STATUS_KEY = {
  approved: "plan_status_approved",
  rejected: "plan_status_rejected",
  cancelled: "plan_status_cancelled",
  expired: "plan_status_expired",
} as const

export function AdminOrderHistory() {
  const { t } = useTranslation()
  const query = trpc.admin.orderHistory.useQuery()

  const status = (s: string) => (s in STATUS_KEY ? t(STATUS_KEY[s as keyof typeof STATUS_KEY]) : s)
  const granted = (o: Row) => (o.grantedUntil ? formatValidUntil(new Date(o.grantedUntil)) : "-")
  const decided = (o: Row) => `${o.decidedBy ?? "-"} · ${dateOrDash(o.decidedAt)}`

  const columns: Column<Row>[] = [
    { header: t("admin_col_created"), cell: (o) => dateOrDash(o.createdAt) },
    { header: t("username"), cell: (o) => <span className="font-medium">{o.username}</span> },
    { header: t("admin_col_plan"), cell: (o) => planLabel(o.plan) },
    { header: t("admin_col_period"), cell: (o) => t(periodKey(o.period)) },
    { header: t("payment_amount"), cell: (o) => formatCurrency(o.amount), className: "whitespace-nowrap text-right" },
    { header: t("admin_col_code"), cell: (o) => <span className="font-mono">{o.code ?? "-"}</span> },
    { header: t("admin_col_status"), cell: (o) => status(o.status) },
    { header: t("admin_col_granted"), cell: granted },
    { header: t("admin_col_decided"), cell: decided },
    { header: t("admin_note"), cell: (o) => o.note ?? "-" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_order_history")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data ?? []}
        getKey={(o) => o.id}
        columns={columns}
        emptyText={t("admin_no_history")}
        renderCard={(o) => (
          <div data-testid="admin-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{o.username}</p>
                <p className="text-slate-500">
                  {planLabel(o.plan)} · {t(periodKey(o.period))} · {formatCurrency(o.amount)}
                </p>
              </div>
              <span className="shrink-0 font-mono">{o.code ?? "-"}</span>
            </div>
            <p className="font-medium text-foreground">{status(o.status)}</p>
            <p className="text-xs text-slate-500">
              {t("admin_col_created")}: {dateOrDash(o.createdAt)} · {t("admin_col_granted")}: {granted(o)}
            </p>
            <p className="text-xs text-slate-500">
              {t("admin_col_decided")}: {decided(o)}
            </p>
            {o.note && (
              <p className="break-words text-xs text-slate-500">
                {t("admin_note")}: {o.note}
              </p>
            )}
          </div>
        )}
      />
    </div>
  )
}
