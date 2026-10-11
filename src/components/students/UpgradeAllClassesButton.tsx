"use client"

import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
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

export type UpgradeResult = RouterOutputs["student"]["upgradeAllClasses"]
export type UpgradeLog = RouterOutputs["student"]["getUpgradeLogThisYear"]

// AK: nút mở nằm trong menu ⋯ của danh sách học sinh; ở đây chỉ còn hộp xác nhận.
export function UpgradeAllClassesDialog({ open, onOpenChange: setOpen }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()

  const mutation = trpc.student.upgradeAllClasses.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("upgrade_all_success")
          .replace("{upgraded}", String(data.upgradedCount))
          .replace("{deactivated}", String(data.deactivatedCount)),
      )
      setOpen(false)
    },
    onError: (err) => {
      toast.error(err.message)
      setOpen(false)
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("upgrade_all_confirm_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("upgrade_all_confirm_body")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : null}
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
