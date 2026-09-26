"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Calculator,
  History,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react"
import { type RouterOutputs, trpc } from "@/lib/trpc"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { paymentSummaryLine } from "@/lib/payment-summary"
import type { PaymentDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { PaymentFormDialog } from "./PaymentFormDialog"
import { TuitionNoticeDialog } from "./TuitionNoticeDialog"
import { LockBadge } from "@/components/plan/LockBadge"
import { LockedSection } from "@/components/plan/LockedSection"
import { openUpgrade } from "@/components/plan/upgrade-store"

type TuitionStatus = RouterOutputs["tuition"]["getMonthlyStatus"]["items"][number]
type SheetData = TuitionStatus & { year: number; month: number }

interface TuitionDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: SheetData | null
  onSuccess: () => void
  paymentsLocked?: boolean
}

export function TuitionDetailSheet({
  open,
  onOpenChange,
  data,
  onSuccess,
  paymentsLocked = false,
}: TuitionDetailSheetProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (!data) return null

  // DialogContent/SheetContent chỉ mount khi mở → phần sửa dở của form tất toán bị bỏ mỗi lần mở lại.
  const body = (
    <TuitionDetailBody
      data={data}
      paymentsLocked={paymentsLocked}
      onSaved={() => {
        onSuccess()
        onOpenChange(false)
      }}
    />
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("tuition_detail")}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-col overflow-hidden">{body}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[450px] p-0 flex flex-col h-full overflow-hidden gap-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("tuition_detail")}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col overflow-hidden">{body}</div>
      </SheetContent>
    </Sheet>
  )
}

function TuitionDetailBody({
  data,
  onSaved,
  paymentsLocked,
}: {
  data: SheetData
  onSaved: () => void
  paymentsLocked: boolean
}) {
  const { t } = useTranslation()
  const { studentId, year, month } = data

  // `data` là bản chụp lúc mở; sheet vẫn mở sau mỗi lần thu nên đọc lại dòng tháng (TRPCProvider tự invalidate).
  const statusQuery = trpc.tuition.getMonthlyStatus.useQuery({ year, month, studentId, page: 1, limit: 1 })
  const row = statusQuery.data?.items[0] ?? data
  const paymentsQuery = trpc.payment.list.useQuery({ studentId, year, month }, { enabled: !paymentsLocked })
  // Ghi nhận thu, tất toán và phiếu báo cùng gói Plus (P3, P7).
  const lockPlus = () => openUpgrade({ plan: "plus" })
  const lockedLabel = t("plan_available_in").replace("{plan}", "Plus")
  const payments = paymentsQuery.data ?? []

  // Chỉ giữ phần người dùng đã sửa; phần chưa sửa theo `row` mới nhất để `dirty` không sáng sai.
  const [edits, setEdits] = useState<{ isFullPaid?: boolean; notes?: string }>({})
  const isFullPaid = edits.isFullPaid ?? row.isFullPaid
  const notes = edits.notes ?? row.notes ?? ""
  const [form, setForm] = useState<{ open: false } | { open: true; payment?: PaymentDTO }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<PaymentDTO | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const settlementMut = trpc.tuition.updateSettlement.useMutation({
    onSuccess: () => {
      toast.success(t("settlement_saved"))
      onSaved()
    },
    onError: (e) => toast.error(e.message),
  })
  const deleteMut = trpc.payment.delete.useMutation({
    onSuccess: () => toast.success(t("payment_deleted")),
    onError: (e) => toast.error(e.message),
  })

  const summary = paymentSummaryLine(row)
  const summaryLabel = { remaining: t("remaining"), overpaid: t("overpaid_amount"), waived: t("waived") }[summary.kind]
  const shortfall = Math.max(0, row.totalAmountDue) - row.paidAmount
  const showWaivedWarning = isFullPaid && shortfall > 0
  const dirty = isFullPaid !== row.isFullPaid || notes !== (row.notes ?? "")

  const settlementBlock = (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Checkbox
          id="tuition-full-paid"
          checked={isFullPaid}
          onCheckedChange={(v) => setEdits((e) => ({ ...e, isFullPaid: v === true }))}
        />
        <Label htmlFor="tuition-full-paid" className="text-sm font-medium">
          {t("mark_fully_paid")}
        </Label>
      </div>

      {showWaivedWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            {t("settled_waived_warning")} {formatCurrency(shortfall)}. {t("settled_waived_warning_suffix")}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="tuition-notes" className="text-xs font-bold text-slate-400">
          {t("notes")}
        </Label>
        <Textarea
          id="tuition-notes"
          placeholder={t("notes_placeholder")}
          className="min-h-[80px] text-sm"
          value={notes}
          onChange={(ev) => setEdits((e) => ({ ...e, notes: ev.target.value }))}
        />
      </div>
    </div>
  )

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Receipt className="size-5 text-blue-600" />
              {t("tuition_detail")}
            </div>
            <div className="text-sm text-slate-500">
              {t("student")}: <span className="font-medium text-slate-900">{row.fullName}</span> • {t("month")}{" "}
              {month}/{year}
            </div>
          </div>

          {/* Bảng tính */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <Calculator className="size-4" />
              {t("fee_breakdown")}
            </h3>
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("previous_balance_short")}</span>
                <span
                  className={cn(
                    "font-medium",
                    row.previousBalance > 0
                      ? "text-debt"
                      : row.previousBalance < 0
                      ? "text-green-600"
                      : "text-slate-400"
                  )}
                >
                  {row.previousBalance > 0 ? "+" : ""}
                  {formatCurrency(row.previousBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {t("current_month_fee")} ({row.presentSessions}/{row.totalSessions} {t("sessions")})
                </span>
                <span className="font-medium text-slate-900">+{formatCurrency(row.totalExpected)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{t("total_amount_due")}</span>
                <span className="text-lg font-medium text-slate-900">{formatCurrency(row.totalAmountDue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("paid_total")}</span>
                <span data-testid="paid-total" className="font-medium text-slate-900">
                  {formatCurrency(row.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{summaryLabel}</span>
                <span
                  data-testid="remaining-line"
                  className={cn(
                    "font-medium",
                    summary.kind === "overpaid"
                      ? "text-green-600"
                      : summary.kind === "waived"
                      ? "text-teal-700"
                      : summary.amount > 0
                      ? "text-debt"
                      : "text-slate-400"
                  )}
                >
                  {formatCurrency(summary.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Lịch sử thu tiền */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                <History className="size-4" />
                {t("payment_history")}
              </h3>
              <Button
                type="button"
                onClick={() => (paymentsLocked ? lockPlus() : setForm({ open: true }))}
                className="h-11 md:h-10"
              >
                <Plus className="mr-1.5 size-4" />
                {t("add_payment")}
                {paymentsLocked && <LockBadge plan="plus" className="ml-1.5" />}
              </Button>
            </div>

            {paymentsLocked ? (
              <LockedSection plan="plus" label={lockedLabel} testId="payments-locked">
                <div className="space-y-2">
                  <div className="h-16 rounded-lg border border-slate-200 bg-white" />
                  <div className="h-16 rounded-lg border border-slate-200 bg-white" />
                </div>
              </LockedSection>
            ) : paymentsQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : payments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                {t("no_payments")}
              </p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} data-testid="payment-row" className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-700">{formatDate(p.paidAt)}</span>
                          <Badge variant="secondary" className="border-none bg-slate-100 font-medium text-slate-600">
                            {p.method === "transfer" ? t("method_transfer") : t("method_cash")}
                          </Badge>
                        </div>
                        {p.note && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.note}</p>}
                      </div>
                      <span className="shrink-0 whitespace-nowrap font-semibold text-slate-900">
                        {formatCurrency(p.amount)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 md:size-9"
                            aria-label={t("actions")}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setForm({ open: true, payment: p })}>
                            <Pencil className="mr-2 size-4" />
                            {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDeleteTarget(p)} className="text-red-600">
                            <Trash2 className="mr-2 size-4" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tất toán & ghi chú tháng */}
          {paymentsLocked ? (
            <LockedSection plan="plus" label={lockedLabel} testId="settlement-locked">
              {settlementBlock}
            </LockedSection>
          ) : (
            settlementBlock
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-4 border-t bg-white p-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-700">{t("payment_tip_snapshot")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            disabled={!paymentsLocked && dirty}
            onClick={() => (paymentsLocked ? lockPlus() : setNoticeOpen(true))}
          >
            <Receipt className="mr-2 size-4" />
            {t("tuition_notice")}
            {paymentsLocked && <LockBadge plan="plus" className="ml-1.5" />}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl font-bold"
            disabled={!paymentsLocked && (!dirty || settlementMut.isPending)}
            onClick={() =>
              paymentsLocked ? lockPlus() : settlementMut.mutate({ studentId, year, month, isFullPaid, notes })
            }
          >
            {settlementMut.isPending ? t("saving") : t("save")}
            {paymentsLocked && <LockBadge plan="plus" className="ml-1.5" />}
          </Button>
        </div>
      </div>

      {noticeOpen && (
        <TuitionNoticeDialog
          studentId={studentId}
          year={year}
          month={month}
          onClose={() => setNoticeOpen(false)}
        />
      )}

      {form.open && (
        <PaymentFormDialog
          studentId={studentId}
          year={year}
          month={month}
          totalAmountDue={row.totalAmountDue}
          paidAmount={row.paidAmount}
          payment={form.payment}
          onClose={() => setForm({ open: false })}
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_payment_confirm")
                .replace("{amount}", formatCurrency(deleteTarget?.amount ?? 0))
                .replace("{date}", deleteTarget ? formatDate(deleteTarget.paidAt) : "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) deleteMut.mutate({ id: deleteTarget.id })
                setDeleteTarget(null)
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
