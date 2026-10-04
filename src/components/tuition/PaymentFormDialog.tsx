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
import { vnTodayIso } from "@/lib/payment-summary"
import type { PaymentBatchDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  batch: PaymentBatchDTO
  onClose: () => void
}

export function PaymentFormDialog({ batch, onClose }: Props) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState<number | undefined>(batch.amount)
  const [paidAt, setPaidAt] = useState(batch.paidAt ?? vnTodayIso())
  const [note, setNote] = useState(batch.note ?? "")

  const utils = trpc.useUtils()
  const updateBatchMut = trpc.payment.updateBatch.useMutation({
    onSuccess: () => {
      void utils.tuition.invalidate()
      void utils.payment.invalidate()
      toast.success(`${t("payment_saved")} ${formatCurrency(amount ?? 0)}`)
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const isPending = updateBatchMut.isPending
  const canSave = !!amount && amount >= 1 && paidAt !== "" && !isPending

  const save = () => {
    if (!amount) return
    updateBatchMut.mutate({
      batchId: batch.batchId,
      amount,
      paidAt,
      note,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit_payment")}</DialogTitle>
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
