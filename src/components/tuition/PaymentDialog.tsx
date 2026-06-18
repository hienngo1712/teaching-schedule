"use client"

import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { History } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
import { updatePaymentSchema, type UpdatePaymentInput } from "@/lib/schemas/tuition"
import { formatCurrency, cn } from "@/lib/utils"
import { mergeOverpaidNote } from "@/lib/payment-notes"
import { useTranslation } from "@/components/providers/LanguageProvider"

type TuitionStatus = RouterOutputs["tuition"]["getMonthlyStatus"]["items"][number]

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: (TuitionStatus & { year: number; month: number }) | null
  onSuccess: () => void
}

export function PaymentDialog({ open, onOpenChange, data, onSuccess }: PaymentDialogProps) {
  const { t } = useTranslation()
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

  // Auto-note "trả dư" đã chèn lần gần nhất — để gỡ/thay idempotent (tránh nhân
  // đôi khi đổi ngôn ngữ, và gỡ khi không còn trả dư).
  const autoNoteRef = useRef<string>("")

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
    mutation.mutate(values)
  }

  // Auto-fill note when overpaid (compared against total adjusted amount, not just this month's fee)
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name !== "paidAmount" || !data) return

      const paidAmount = value.paidAmount || 0
      const adjustedAmount = Math.max(0, data.totalExpected + data.previousBalance)
      const excess = paidAmount - adjustedAmount
      const autoNote =
        excess > 0
          ? `${t("overpaid_note_prefix")} ${formatCurrency(excess)}, ${t("overpaid_note_suffix")} ${formatCurrency(excess)}`
          : ""

      if (autoNote === autoNoteRef.current) return

      const merged = mergeOverpaidNote({
        rawNotes: form.getValues("notes") || "",
        prevAutoNote: autoNoteRef.current,
        autoNote,
      })
      form.setValue("notes", merged)
      autoNoteRef.current = autoNote
    })
    return () => subscription.unsubscribe()
  }, [form, data, t])

  function quickPayFull() {
    if (!data) return
    form.setValue("paidAmount", data.totalExpected)
  }

  function quickPayAdjusted() {
    if (!data) return
    const adjusted = Math.max(0, data.totalExpected + data.previousBalance)
    form.setValue("paidAmount", adjusted)
    form.setValue("isFullPaid", true)
  }

  if (!data) return null

  const adjustedAmount = Math.max(0, data.totalExpected + data.previousBalance)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>{t("record_payment")}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-100 space-y-2 text-center">
            <div className="flex flex-col items-center">
              <p className="text-sm font-medium text-slate-500">{t("student")}</p>
              <p className="font-semibold text-slate-900">{data.fullName}</p>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("month")}</p>
                <p className="font-semibold text-slate-700">{data.month}/{data.year}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("tuition")}</p>
                <p className="font-semibold text-slate-700">{formatCurrency(data.totalExpected)}</p>
              </div>
            </div>
            
            {data.previousBalance !== 0 && (
              <div className={cn(
                "flex justify-between items-center pt-2 border-t text-sm",
                data.previousBalance > 0 ? "text-red-600" : "text-green-600"
              )}>
                <div className="flex items-center gap-1">
                  <History className="size-3.5" />
                  <span>{t("previous_balance")}:</span>
                </div>
                <span className="font-bold">
                  {data.previousBalance > 0 ? "+" : ""}{formatCurrency(data.previousBalance)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t text-sm text-slate-900 font-bold italic">
              <span>{t("amount_to_pay")}:</span>
              <span>{formatCurrency(adjustedAmount)}</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("amount_paid")}</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={(v) => field.onChange(v)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isFullPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        {t("mark_fully_paid")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("notes")}
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-center pt-2">
                <div className="flex flex-wrap gap-2 justify-center w-full sm:w-auto">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="h-9 px-4"
                    onClick={quickPayFull}
                  >
                    {t("pay_full")}
                  </Button>
                  {data.previousBalance !== 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={quickPayAdjusted}
                      className="h-9 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100"
                    >
                      {t("pay_adjusted")}
                    </Button>
                  )}
                </div>
                <Button type="submit" className="h-9 px-8 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto" disabled={mutation.isPending}>
                  {mutation.isPending ? t("saving") : t("save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
