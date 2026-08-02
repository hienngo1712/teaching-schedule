"use client"

import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { AlertTriangle, Calculator, Info, Receipt, Wallet } from "lucide-react"
import { type RouterOutputs, trpc } from "@/lib/trpc"
import { type UpdatePaymentInput, updatePaymentSchema } from "@/lib/schemas/tuition"
import { cn, formatCurrency } from "@/lib/utils"
import { mergeOverpaidNote } from "@/lib/payment-notes"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Separator } from "@/components/ui/separator"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type TuitionStatus = RouterOutputs["tuition"]["getMonthlyStatus"]["items"][number]

interface TuitionDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: (TuitionStatus & { year: number; month: number }) | null
  onSuccess: () => void
}

export function TuitionDetailSheet({ open, onOpenChange, data, onSuccess }: TuitionDetailSheetProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  // Auto-note "trả dư" đã chèn lần gần nhất — để gỡ/thay idempotent khi GV sửa
  // lại số tiền hoặc đổi ngôn ngữ.
  const autoNoteRef = useRef<string>("")
  // Giá trị trên DB TRƯỚC lần ghi gần nhất — dùng cho nút Hoàn tác trên toast.
  const prevValuesRef = useRef<UpdatePaymentInput | null>(null)
  // Chặn hiện tiếp nút Hoàn tác trên toast của chính lần hoàn tác (1 cấp là đủ).
  const isUndoingRef = useRef(false)

  const mutation = trpc.tuition.updatePayment.useMutation({
    onSuccess: (_result, variables) => {
      onSuccess()
      onOpenChange(false)

      if (isUndoingRef.current) {
        isUndoingRef.current = false
        toast.success(t("undo_success"))
        return
      }

      const prev = prevValuesRef.current
      const title =
        variables.paidAmount === 0 && !variables.isFullPaid
          ? t("cancel_payment_success")
          : `${t("payment_saved_for_month")} ${variables.month}/${variables.year}: ${formatCurrency(variables.paidAmount)}`

      toast.success(title, {
        action: prev
          ? {
              label: t("undo"),
              onClick: () => {
                isUndoingRef.current = true
                mutation.mutate(prev)
              },
            }
          : undefined,
      })
    },
    onError: (error) => {
      isUndoingRef.current = false
      toast.error(error.message)
    },
  })

  const form = useForm<UpdatePaymentInput>({
    resolver: zodResolver(updatePaymentSchema),
    defaultValues: {
      studentId: 0,
      year: 0,
      month: 0,
      paidAmount: 0,
      isFullPaid: false,
      notes: "",
    },
  })

  useEffect(() => {
    if (data && open) {
      form.reset({
        studentId: data.studentId,
        year: data.year,
        month: data.month,
        paidAmount: data.paidAmount,
        isFullPaid: data.isFullPaid,
        notes: data.notes || "",
      })
      // Ghi chú nạp từ data là của user — chưa có auto-note nào do form này chèn.
      autoNoteRef.current = ""
    }
  }, [data, open, form])

  function onSubmit(values: UpdatePaymentInput) {
    if (data) {
      prevValuesRef.current = {
        studentId: data.studentId,
        year: data.year,
        month: data.month,
        paidAmount: data.paidAmount,
        isFullPaid: data.isFullPaid,
        notes: data.notes || "",
      }
    }
    mutation.mutate(values)
  }

  // Auto-fill note khi trả dư — luôn gỡ auto-note cũ trước khi chèn cái mới, nên
  // sửa lại số tiền sẽ cập nhật/gỡ đúng thay vì để lại ghi chú sai.
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name !== "paidAmount" || !data) return

      const paidAmount = value.paidAmount || 0
      const excess = paidAmount - Math.max(0, data.totalAmountDue)
      const autoNote =
        excess > 0
          ? `${t("overpaid_note_prefix")} ${formatCurrency(excess)}, ${t("overpaid_note_suffix")} ${formatCurrency(excess)}`
          : ""

      if (autoNote === autoNoteRef.current) return

      form.setValue(
        "notes",
        mergeOverpaidNote({
          rawNotes: form.getValues("notes") || "",
          prevAutoNote: autoNoteRef.current,
          autoNote,
        })
      )
      autoNoteRef.current = autoNote
    })
    return () => subscription.unsubscribe()
  }, [form, data, t])

  const watchedPaidAmount = form.watch("paidAmount")
  const watchedIsFullPaid = form.watch("isFullPaid")

  // Đã có ghi nhận trên DB → form đang ở chế độ SỬA, không phải nhập mới.
  const hasRecordedPayment = !!data && (data.paidAmount > 0 || data.isFullPaid)
  const shortfall = data ? Math.max(0, data.totalAmountDue) - (watchedPaidAmount || 0) : 0
  const showWaivedWarning = watchedIsFullPaid && shortfall > 0

  function handleCancelPayment() {
    if (!data) return
    prevValuesRef.current = {
      studentId: data.studentId,
      year: data.year,
      month: data.month,
      paidAmount: data.paidAmount,
      isFullPaid: data.isFullPaid,
      notes: data.notes || "",
    }
    mutation.mutate({
      studentId: data.studentId,
      year: data.year,
      month: data.month,
      paidAmount: 0,
      isFullPaid: false,
      // Gỡ auto-note trả dư, giữ lại ghi chú do GV nhập.
      notes: mergeOverpaidNote({
        rawNotes: form.getValues("notes") || "",
        prevAutoNote: autoNoteRef.current,
        autoNote: "",
      }),
    })
  }

  function quickPayFull() {
    if (!data) return
    form.setValue("paidAmount", data.totalExpected)
  }

  function quickPayAdjusted() {
    if (!data) return
    form.setValue("paidAmount", data.totalAmountDue)
    form.setValue("isFullPaid", true)
  }

  if (!data) return null

  const mainContent = (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Receipt className="size-5 text-blue-600" />
          {t("tuition_detail")}
        </div>
        <div className="text-sm text-slate-500">
          {t("student")}:{" "}
          <span className="font-medium text-slate-900">{data.fullName}</span> • {t("month")}{" "}
          {data.month}/{data.year}
        </div>
      </div>

      {hasRecordedPayment && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-blue-700 font-medium">{t("recorded_amount")}</span>
          <span className="font-bold text-blue-900">{formatCurrency(data.paidAmount)}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="size-4" />
            {t("fee_breakdown")}
          </h3>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">{t("previous_balance_short")}</span>
              <span
                className={cn(
                  "font-medium",
                  data.previousBalance > 0
                    ? "text-red-600"
                    : data.previousBalance < 0
                    ? "text-green-600"
                    : "text-slate-400"
                )}
              >
                {data.previousBalance > 0 ? "+" : ""}
                {formatCurrency(data.previousBalance)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">
                {t("current_month_fee")} ({data.presentSessions}/{data.totalSessions} {t("sessions")})
              </span>
              <span className="font-medium text-slate-900">+{formatCurrency(data.totalExpected)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">{t("total_amount_due")}</span>
              <span className="text-lg font-medium text-slate-900">
                {formatCurrency(data.totalAmountDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Payment Status */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Wallet className="size-4" />
            {t("payment_action")}
          </h3>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="paidAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-slate-400">{t("amount_paid")}</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      className="text-lg font-medium h-12"
                    />
                  </FormControl>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={quickPayFull}>
                      {t("pay_current_month")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100"
                      onClick={quickPayAdjusted}
                    >
                      {t("pay_full_debt")}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isFullPaid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border border-slate-200 p-3 bg-white shadow-sm">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-medium">{t("mark_fully_paid")}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {showWaivedWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 items-start">
                <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  {t("settled_waived_warning")} {formatCurrency(shortfall)}. {t("settled_waived_warning_suffix")}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-slate-400">{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("notes_placeholder")}
                      className="min-h-[80px] text-sm"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )

  const footer = (
    <div className="p-6 border-t bg-white space-y-4">
      <div className="bg-amber-50 rounded-xl p-3 flex gap-3 items-start border border-amber-100">
        <Info className="size-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">{t("payment_tip_snapshot")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          className="w-full h-12 text-md font-bold bg-black hover:bg-slate-800 text-white shadow-lg transition-all active:scale-[0.98] rounded-xl"
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? t("saving")
            : hasRecordedPayment
            ? t("update_payment")
            : t("confirm_payment")}
        </Button>

        {hasRecordedPayment && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-11 font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                disabled={mutation.isPending}
              >
                {t("cancel_payment")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("cancel_payment_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("cancel_payment_confirm_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleCancelPayment}
                >
                  {t("cancel_payment")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("tuition_detail")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0">{mainContent}</div>
              <div className="shrink-0">{footer}</div>
            </form>
          </Form>
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-0">{mainContent}</div>
            <div className="shrink-0">{footer}</div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
