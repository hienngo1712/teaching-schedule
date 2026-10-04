"use client"
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
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const formattedAmount = formatCurrency(amount)

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
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
            onClick={onConfirm}
          >
            {t("waive_confirm").replace("{amount}", formattedAmount)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
