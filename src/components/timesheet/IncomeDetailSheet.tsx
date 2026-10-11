"use client"

import { useState } from "react"
import { FileText, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LockedSection } from "@/components/plan/LockedSection"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { trpc } from "@/lib/trpc"
import { PLAN_LABEL } from "@/lib/plans"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { formatHours } from "@/lib/timesheet-export"
import { IncomeStatusBadge } from "./IncomeStatusBadge"
import { PlacePaymentDialog } from "./PlacePaymentDialog"

type Target = { placeId: number; name: string; color: string; year: number; month: number }

// Chi tiết thu nhập 1 nơi (mẫu 10s, theo TuitionDetailSheet): tab Diễn giải | Lịch sử nhận.
// onOpenNotice: có khi tháng có ca đã dạy (mở hộp Phiếu báo, spec AN §1).
export function IncomeDetailSheet({
  target,
  onOpenChange,
  onOpenNotice,
}: {
  target: Target | null
  onOpenChange: (open: boolean) => void
  onOpenNotice?: () => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { t } = useTranslation()
  const title = target ? target.name : ""
  const body = target && <IncomeDetailBody target={target} onOpenNotice={onOpenNotice} />

  if (isDesktop) {
    return (
      <Dialog open={!!target} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[500px]">
          <DialogHeader className="sr-only">
            <DialogTitle>{title || t("income_tab")}</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[450px]">
        <SheetHeader className="sr-only">
          <SheetTitle>{title || t("income_tab")}</SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}

function IncomeDetailBody({ target, onOpenNotice }: { target: Target; onOpenNotice?: () => void }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const gate = useFeatureGate("placePayments")
  const [tab, setTab] = useState<"breakdown" | "history">("breakdown")
  const [recording, setRecording] = useState(false)
  const [deleting, setDeleting] = useState<{ id: number; amount: number; receivedAt: string } | null>(null)
  const { placeId, year, month } = target
  const query = trpc.income.detail.useQuery({ placeId, year, month })
  const data = query.data

  const del = trpc.placePayment.delete.useMutation({
    onSuccess: async () => {
      toast.success(t("place_payment_deleted"))
      setDeleting(null)
      await utils.income.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const expected = data?.expected ?? 0
  const received = data?.received ?? 0
  const remaining = Math.max(0, expected - received)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="income-detail">
      <div className="border-b px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: target.color }} />
          <h2 className="truncate text-lg font-semibold text-slate-900">{target.name}</h2>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            {t("income_detail_title").replace("{month}", String(month)).replace("{year}", String(year))}
          </p>
          {data && <IncomeStatusBadge status={data.status} />}
        </div>
        <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(["breakdown", "history"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("min-h-11 rounded-md text-sm font-semibold md:min-h-9", tab === k ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >
              {t(k === "breakdown" ? "income_tab_breakdown" : "income_tab_history")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {query.isPending ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-400" />
          </div>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-slate-500">{t("load_error")}</p>
        ) : tab === "breakdown" ? (
          <dl className="space-y-3 text-sm">
            {data.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">
                  {l.unit === "hour"
                    ? t("income_line_hour").replace("{hours}", formatHours(l.hours)).replace("{amount}", formatCurrency(l.amount))
                    : t("income_line_session").replace("{count}", String(l.count)).replace("{amount}", formatCurrency(l.amount))}
                </dt>
                <dd className="font-medium tabular-nums text-slate-900">{formatCurrency(l.total)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <dt className="font-medium text-slate-700">{t("income_total")}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{formatCurrency(expected)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">{t("income_received")}</dt>
              <dd className="font-medium tabular-nums text-primary">{formatCurrency(received)}</dd>
            </div>
            {received > expected ? (
              <p className="text-right text-sm font-medium text-success">
                {t("income_overpaid").replace("{amount}", formatCurrency(received - expected))}
              </p>
            ) : (
              remaining > 0 && (
                <p className="text-right text-sm font-medium text-debt">
                  {t("income_shortfall").replace("{amount}", formatCurrency(remaining))}
                </p>
              )
            )}
          </dl>
        ) : data.payments === null ? (
          <LockedSection plan={gate.requiredPlan} label={t("plan_available_in").replace("{plan}", PLAN_LABEL[gate.requiredPlan])}>
            <p className="py-8 text-center text-sm text-slate-500">{t("income_no_payments")}</p>
          </LockedSection>
        ) : data.payments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("income_no_payments")}</p>
        ) : (
          <ul className="divide-y">
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{formatDate(p.receivedAt)}</p>
                  {p.note && <p className="truncate text-xs text-slate-500">{p.note}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-slate-400 md:size-9"
                    aria-label={t("delete")}
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t p-4">
        <Button variant="outline" className="h-11" disabled={!onOpenNotice} onClick={onOpenNotice}>
          <FileText className="mr-1.5 size-4" />
          {t("place_notice")}
        </Button>
        <Button className="h-11" disabled={!data} onClick={gate.guard(() => setRecording(true))} data-tour="income-record">
          {t("income_record")}
        </Button>
      </div>

      {recording && (
        <PlacePaymentDialog
          placeId={placeId}
          placeName={target.name}
          year={year}
          month={month}
          remaining={remaining}
          onClose={() => setRecording(false)}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleting &&
                t("income_delete_confirm").replace("{amount}", formatCurrency(deleting.amount)).replace("{date}", formatDate(deleting.receivedAt))}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleting) del.mutate({ id: deleting.id })
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
