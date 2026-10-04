"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Calculator,
  History,
  MoreHorizontal,
  Pencil,
  Receipt,
  Trash2,
} from "lucide-react"
import { type RouterOutputs, trpc } from "@/lib/trpc"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import type { PaymentBatchDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"
import dayjs from "@/lib/dayjs"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
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
import { TuitionStatusBadge } from "./TuitionStatusBadge"
import { PayBlock } from "./PayBlock"
import { WaiveDialog } from "./WaiveDialog"
import { LockedSection } from "@/components/plan/LockedSection"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { dueNow, isProvisional, noticeAgeDays, NOTICE_OVERDUE_DAYS } from "@/lib/tuition-display"

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
  paymentsLocked = false,
}: TuitionDetailSheetProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (!data) return null

  const body = (
    <TuitionDetailBody
      data={data}
      paymentsLocked={paymentsLocked}
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
  paymentsLocked,
}: {
  data: SheetData
  paymentsLocked: boolean
}) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const { studentId, year, month } = data

  const statusQuery = trpc.tuition.getMonthlyStatus.useQuery(
    { year, month, studentId, page: 1, limit: 1 },
    { initialData: { items: [data], totalCount: 1, totalPages: 1 } }
  )
  const row = statusQuery.data?.items[0] ?? data
  const batchesQuery = trpc.payment.listBatches.useQuery({ studentId, year, month }, { enabled: !paymentsLocked })

  const lockPlus = () => openUpgrade({ plan: "plus" })
  const lockedLabel = t("plan_available_in").replace("{plan}", "Plus")
  const batches = batchesQuery.data ?? []

  const [notes, setNotes] = useState(row.notes ?? "")
  const [notesSaved, setNotesSaved] = useState(false)
  const [waiveOpen, setWaiveOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<PaymentBatchDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentBatchDTO | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const setNoticeSentMut = trpc.tuition.setNoticeSent.useMutation({
    onSuccess: () => {
      void utils.tuition.getMonthlyStatus.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const updateSettlementMut = trpc.tuition.updateSettlement.useMutation({
    onSuccess: () => {
      void utils.tuition.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteBatchMut = trpc.payment.deleteBatch.useMutation({
    onSuccess: () => {
      void utils.tuition.invalidate()
      void utils.payment.invalidate()
      toast.success(t("payment_deleted"))
    },
    onError: (e) => toast.error(e.message),
  })

  // Đóng sheet bằng Esc/vuốt không bắn blur → lưu ghi chú còn dở khi unmount (client thường, không phụ thuộc component).
  const pendingNotes = useRef({ notes, saved: row.notes ?? "" })
  pendingNotes.current = { notes, saved: row.notes ?? "" }
  useEffect(() => {
    return () => {
      const { notes: n, saved } = pendingNotes.current
      if (n !== saved) {
        void utils.client.tuition.updateSettlement
          .mutate({ studentId, year, month, notes: n === "" ? null : n })
          .then(() => utils.tuition.invalidate())
          .catch((e: Error) => toast.error(e.message))
      }
    }
  }, [utils, studentId, year, month])

  const due = dueNow(row)
  const prevM = month === 1 ? 12 : month - 1
  const isProv = isProvisional(row)

  const handleBlurNotes = () => {
    if (notes !== (row.notes ?? "")) {
      updateSettlementMut.mutate(
        { studentId, year, month, notes: notes === "" ? null : notes },
        {
          onSuccess: () => {
            setNotesSaved(true)
            setTimeout(() => setNotesSaved(false), 2000)
          },
        }
      )
    }
  }

  const handleConfirmWaive = () => {
    updateSettlementMut.mutate(
      { studentId, year, month, isFullPaid: true },
      {
        onSuccess: () => {
          setWaiveOpen(false)
          toast.success(t("settlement_saved"))
        },
      }
    )
  }

  const handleUnwaive = () => {
    updateSettlementMut.mutate(
      { studentId, year, month, isFullPaid: false },
      {
        onSuccess: () => toast.success(t("settlement_saved")),
      }
    )
  }

  const noticeAge = row.noticeSentAt ? noticeAgeDays(row.noticeSentAt) : 0
  const noticeOverdue = noticeAge >= NOTICE_OVERDUE_DAYS && due > 0

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-900 truncate">{row.fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>
                  {t("tuition_month_title").replace("{m}", String(month)).replace("{y}", String(year))}
                </span>
                <TuitionStatusBadge item={row} />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.isFullPaid ? (
                  <DropdownMenuItem onClick={handleUnwaive}>
                    {t("unwaive")}
                  </DropdownMenuItem>
                ) : (
                  // Tháng đang học tạm tính: miễn sẽ xoá luôn tiền các buổi còn lại của tháng → chỉ miễn ở tháng nợ.
                  due > 0 && !isProv && (
                    <DropdownMenuItem onClick={() => setWaiveOpen(true)} className="text-amber-600">
                      {t("waive_title")}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bảng tính tiền */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <Calculator className="size-4" />
              {t("fee_breakdown")}
            </h3>
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              {row.previousBalance !== 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {row.previousBalance < 0
                      ? t("prepaid_label")
                      : row.debtMonths > 1
                      ? t("debt_n_months_label").replace("{n}", String(row.debtMonths))
                      : t("debt_prev_month_label").replace("{m}", String(prevM))}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      row.previousBalance > 0 ? "text-debt" : "text-green-600"
                    )}
                  >
                    {row.previousBalance > 0 ? "+" : ""}
                    {formatCurrency(row.previousBalance)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className={cn("text-slate-500", isProv && "text-slate-400 italic")}>
                  {isProv
                    ? t("month_provisional_line").replace("{m}", String(month)).replace("{p}", String(row.presentSessions))
                    : row.billingMode === "monthly"
                    ? t("tuition_monthly_package_line")
                        .replace("{p}", String(row.presentSessions))
                        .replace("{n}", String(row.totalSessions))
                    : `${t("current_month_fee")} (${row.presentSessions}/${row.totalSessions} ${t("sessions")})`}
                </span>
                <span className={cn("font-medium tabular-nums", isProv ? "text-slate-400" : "text-slate-900")}>
                  +{formatCurrency(row.totalExpected)}
                </span>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("paid_total")}</span>
                <span data-testid="paid-total" className="font-medium text-slate-900 tabular-nums">
                  {formatCurrency(row.paidAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between font-semibold text-base">
                <span>{isProv ? t("due_now") : t("remaining_due")}</span>
                <span
                  data-testid="remaining-line"
                  className={cn(
                    "tabular-nums",
                    row.isFullPaid
                      ? "text-teal-700"
                      : due > 0
                      ? "text-debt"
                      : "text-slate-400"
                  )}
                >
                  {row.isFullPaid
                    ? `${t("waived")} ${formatCurrency(Math.max(0, row.totalAmountDue - row.paidAmount))}`
                    : formatCurrency(due)}
                </span>
              </div>
            </div>
          </div>

          {/* Thu tiền */}
          {paymentsLocked ? (
            <LockedSection plan="plus" label={lockedLabel} testId="payments-locked">
              <div className="h-24 rounded-lg border border-slate-200 bg-white" />
            </LockedSection>
          ) : (
            <PayBlock studentId={studentId} year={year} month={month} due={due} />
          )}

          {/* Phiếu báo */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <Receipt className="size-4" />
              {t("tuition_notice")}
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-sm">
                {row.noticeSentAt ? (
                  <span className={cn("font-medium", noticeOverdue ? "text-amber-700" : "text-slate-700")}>
                    {t("notice_sent_detail")
                      .replace("{d}", dayjs(row.noticeSentAt).tz("Asia/Ho_Chi_Minh").format("D/M"))
                      .replace("{t}", dayjs(row.noticeSentAt).tz("Asia/Ho_Chi_Minh").format("HH:mm"))}
                  </span>
                ) : (
                  <span className="text-slate-500">{t("notice_unsent")}</span>
                )}
                {row.noticeStatus === "changed" && (
                  <span data-testid="notice-changed-hint" className="mt-0.5 block text-xs font-medium text-amber-700">
                    {t("notice_changed")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => (paymentsLocked ? lockPlus() : setNoticeOpen(true))}
                >
                  <Receipt className="mr-1.5 size-3.5" />
                  {t("tuition_notice")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-slate-500"
                  disabled={setNoticeSentMut.isPending}
                  onClick={() =>
                    setNoticeSentMut.mutate({
                      studentId,
                      year,
                      month,
                      sent: row.noticeStatus === "none",
                    })
                  }
                >
                  {row.noticeStatus === "none" ? t("mark_notice_sent") : t("unmark_notice_sent")}
                </Button>
              </div>
            </div>
          </div>

          {/* Lịch sử thu tiền theo đợt */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <History className="size-4" />
              {t("payment_history")}
            </h3>

            {paymentsLocked ? (
              <LockedSection plan="plus" label={lockedLabel} testId="history-locked">
                <div className="h-16 rounded-lg border border-slate-200 bg-white" />
              </LockedSection>
            ) : batchesQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : batches.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                {t("no_payments")}
              </p>
            ) : (
              <ul className="space-y-2">
                {batches.map((b) => {
                  const showParts =
                    b.allocations.length > 1 ||
                    (b.allocations.length === 1 && (b.allocations[0].year !== year || b.allocations[0].month !== month))
                  const partsText = b.allocations
                    .map((a) => `T${a.month} ${formatCurrency(a.amount)}`)
                    .join(" · ")

                  return (
                    <li key={b.batchId} data-testid="payment-row" className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{formatDate(b.paidAt)}</span>
                          </div>
                          {showParts && (
                            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                              {partsText}
                            </p>
                          )}
                          {b.note && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{b.note}</p>}
                        </div>
                        <span className="shrink-0 whitespace-nowrap font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(b.amount)}
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
                            <DropdownMenuItem onSelect={() => setEditingBatch(b)}>
                              <Pencil className="mr-2 size-4" />
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeleteTarget(b)} className="text-red-600">
                              <Trash2 className="mr-2 size-4" />
                              {t("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Ghi chú tháng */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="tuition-notes" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t("notes")}
              </label>
              {notesSaved && <span className="text-xs text-teal-600 font-medium">{t("notes_saved")}</span>}
            </div>
            <Textarea
              id="tuition-notes"
              placeholder={t("notes_placeholder")}
              className="min-h-[72px] text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleBlurNotes}
            />
          </div>
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

      {editingBatch && (
        <PaymentFormDialog
          batch={editingBatch}
          onClose={() => setEditingBatch(null)}
        />
      )}

      <WaiveDialog
        open={waiveOpen}
        onOpenChange={setWaiveOpen}
        amount={due}
        month={month}
        onConfirm={handleConfirmWaive}
      />

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
                if (deleteTarget) deleteBatchMut.mutate({ batchId: deleteTarget.batchId })
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
