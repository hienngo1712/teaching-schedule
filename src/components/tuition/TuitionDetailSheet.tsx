"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Calculator, Info, Receipt, Wallet } from "lucide-react"
import { type RouterOutputs, trpc } from "@/lib/trpc"
import { type UpdatePaymentInput, updatePaymentSchema } from "@/lib/schemas/tuition"
import { cn, formatCurrency } from "@/lib/utils"
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

  const mutation = trpc.tuition.updatePayment.useMutation({
    onSuccess: () => {
      toast.success(t("payment_update_success"))
      onSuccess()
      onOpenChange(false)
    },
    onError: (error) => {
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
    }
  }, [data, open, form])

  function onSubmit(values: UpdatePaymentInput) {
    mutation.mutate(values)
  }

  // Auto-fill note when overpaid
  const watchedPaidAmount = form.watch("paidAmount")
  useEffect(() => {
    if (data && watchedPaidAmount !== undefined) {
      const paidAmount = watchedPaidAmount
      const totalAmountDue = data.totalAmountDue
      const currentNotes = form.getValues("notes") || ""
      const prefix = t("overpaid_note_prefix")

      if (paidAmount > totalAmountDue && totalAmountDue > 0) {
        const excess = paidAmount - totalAmountDue
        const overpaidNote = `${prefix} ${formatCurrency(excess)}, ${t("overpaid_note_suffix")} ${formatCurrency(excess)}`

        if (!currentNotes.includes(prefix)) {
          form.setValue("notes", currentNotes ? `${currentNotes}\n${overpaidNote}` : overpaidNote)
        }
      }
    }
  }, [watchedPaidAmount, data, form, t])

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

      <Button
        type="submit"
        className="w-full h-12 text-md font-bold bg-black hover:bg-slate-800 text-white shadow-lg transition-all active:scale-[0.98] rounded-xl"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? t("saving") : t("confirm_payment")}
      </Button>
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
