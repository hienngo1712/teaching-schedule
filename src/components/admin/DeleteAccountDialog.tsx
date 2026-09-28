"use client"

import { toast } from "sonner"
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
import { trpc } from "@/lib/trpc"

export function DeleteAccountDialog({
  user,
  onOpenChange,
}: {
  user: { id: number; username: string }
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const del = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success(t("admin_account_deleted").replace("{username}", user.username))
      void utils.admin?.overview?.invalidate?.()
      void utils.admin?.deletedUsers?.invalidate?.()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin_delete_account_title").replace("{username}", user.username)}</AlertDialogTitle>
          <AlertDialogDescription>{t("admin_delete_account_desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-10" disabled={del.isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-red-600 hover:bg-red-700 md:h-10"
            disabled={del.isPending}
            onClick={(e) => {
              e.preventDefault()
              del.mutate({ userId: user.id })
            }}
          >
            {t("admin_delete_account")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
