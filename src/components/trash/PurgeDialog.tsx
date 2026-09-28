"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  open: boolean
  count: number
  typeLabel: string | null
  isStudent: boolean
  pending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function PurgeDialog({ open, count, typeLabel, isStudent, pending, onConfirm, onOpenChange }: Props) {
  const { t } = useTranslation()
  const title = typeLabel
    ? t("purge_title_tab").replace("{n}", String(count)).replace("{type}", typeLabel.toLowerCase())
    : t("purge_title_all").replace("{n}", String(count))
  return (
    // Đang dọn thì không cho đóng: tránh người dùng tưởng đã huỷ trong khi server vẫn xoá.
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{t("purge_warning")}</p>
              {isStudent && <p>{t("purge_student_note")}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-11 md:h-10" disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button type="button" className="h-11 bg-red-600 hover:bg-red-700 md:h-10" disabled={pending} onClick={onConfirm}>
            {pending ? t("processing") : t("purge_confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
