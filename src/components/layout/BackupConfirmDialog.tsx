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
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }

// File sao lưu là bản rõ toàn bộ dữ liệu → nhắc trước khi tải (spec O Q14).
export function BackupConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("backup_confirm_title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("backup_confirm_desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-10">{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction className="h-11 md:h-10" onClick={onConfirm}>
            {t("backup_confirm_download")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
