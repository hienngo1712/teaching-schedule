"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc"
import { vnTodayIso } from "@/lib/payment-summary"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  placeId: number
  placeName: string
  year: number
  month: number
  // Mặc định = còn thiếu (spec AM §4.1).
  remaining: number
  onClose: () => void
}

// Ghi nhận tiền nơi dạy đã trả, theo PaymentFormDialog: số tiền, ngày nhận, ghi chú.
export function PlacePaymentDialog({ placeId, placeName, year, month, remaining, onClose }: Props) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [amount, setAmount] = useState<number | undefined>(remaining > 0 ? remaining : undefined)
  const [receivedAt, setReceivedAt] = useState(vnTodayIso())
  const [note, setNote] = useState("")

  const create = trpc.placePayment.create.useMutation({
    onSuccess: async () => {
      toast.success(t("place_payment_saved"))
      await utils.income.invalidate()
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const submit = () => {
    if (!amount || amount <= 0) return
    create.mutate({ placeId, year, month, amount, receivedAt, note: note.trim() || undefined })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("income_record")}</DialogTitle>
          <p className="text-sm text-slate-500">
            {placeName} · {t("income_detail_title").replace("{month}", String(month)).replace("{year}", String(year))}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="place-payment-amount">{t("place_payment_amount")}</Label>
            <CurrencyInput
              id="place-payment-amount"
              inputMode="numeric"
              value={amount}
              onChange={setAmount}
              className="h-11 text-lg md:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-payment-date">{t("place_payment_date")}</Label>
            <Input id="place-payment-date" type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="h-11 md:h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-payment-note">{t("notes")}</Label>
            <Textarea id="place-payment-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="min-h-[72px] text-sm" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="h-11 md:h-10" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button className="h-11 md:h-10" disabled={!amount || amount <= 0 || !receivedAt || create.isPending} onClick={submit}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("income_record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
