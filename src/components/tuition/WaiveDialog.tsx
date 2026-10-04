"use client"
import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function WaiveDialog({
  open,
  onOpenChange,
  amount,
  month,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  month: number
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation()
  const formattedAmount = formatCurrency(amount)
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (open) setReason("")
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("waive_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("waive_desc")
              .replace("{amount}", formattedAmount)
              .replace("{m}", String(month))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="waive-reason">{t("waive_reason_label")}</Label>
          <Input
            id="waive-reason"
            value={reason}
            maxLength={200}
            placeholder={t("waive_reason_placeholder")}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 sm:h-9"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
            onClick={() => onConfirm(reason.trim())}
          >
            {t("waive_confirm").replace("{amount}", formattedAmount)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
