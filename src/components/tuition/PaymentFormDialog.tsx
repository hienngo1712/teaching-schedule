"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { remainingToFill, vnTodayIso } from "@/lib/payment-summary"
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/schemas/payment"
import type { PaymentDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

const METHOD_LABEL = { cash: "method_cash", transfer: "method_transfer" } as const

type Props = {
  studentId: number
  year: number
  month: number
  totalAmountDue: number
  paidAmount: number
  payment?: PaymentDTO
  onClose: () => void
}

// Chỉ mount khi mở (xem TuitionDetailSheet) nên state khởi tạo thẳng từ props.
export function PaymentFormDialog({ studentId, year, month, totalAmountDue, paidAmount, payment, onClose }: Props) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState<number | undefined>(payment?.amount)
  const [paidAt, setPaidAt] = useState(payment?.paidAt ?? vnTodayIso())
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "cash")
  const [note, setNote] = useState(payment?.note ?? "")

  const handlers = {
    onSuccess: (saved: PaymentDTO) => {
      toast.success(`${t("payment_saved")} ${formatCurrency(saved.amount)}`)
      onClose()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  }
  const createMut = trpc.payment.create.useMutation(handlers)
  const updateMut = trpc.payment.update.useMutation(handlers)
  const isPending = createMut.isPending || updateMut.isPending

  const fill = remainingToFill(totalAmountDue, paidAmount, payment?.amount ?? 0)
  const canSave = !!amount && amount >= 1 && paidAt !== "" && !isPending

  const save = () => {
    if (!amount) return
    const data = { amount, paidAt, method, note }
    if (payment) updateMut.mutate({ id: payment.id, data })
    else createMut.mutate({ studentId, year, month, ...data })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payment ? t("edit_payment") : `${t("add_payment_title")} ${month}/${year}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t("payment_amount")}</Label>
            <CurrencyInput
              id="payment-amount"
              inputMode="numeric"
              value={amount}
              onChange={setAmount}
              className="h-11 text-lg md:h-10"
            />
            {fill > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 md:h-9"
                onClick={() => setAmount(fill)}
              >
                {t("fill_remaining")}: {formatCurrency(fill)}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">{t("payment_date")}</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-11 md:h-10"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("payment_method")}</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={method === m ? "default" : "outline"}
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                  className="h-11"
                >
                  {t(METHOD_LABEL[m])}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">{t("notes")}</Label>
            <Textarea
              id="payment-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[72px] text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 w-full sm:w-auto md:h-10">
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave} className="h-11 w-full sm:w-auto md:h-10">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
