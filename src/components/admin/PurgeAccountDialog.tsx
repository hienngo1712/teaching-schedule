"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"

// Mã lỗi server (spec AQ §5) → câu hiển thị.
const ERROR_KEY = { purge_too_early: "admin_purge_too_early", purge_confirm_mismatch: "admin_purge_confirm_mismatch" } as const

// Spec AQ §6: gõ đúng tên đăng nhập (nguyên văn, không trim / đổi hoa thường) mới bật nút đỏ.
export function PurgeAccountDialog({
  user,
  onOpenChange,
}: {
  user: { id: number; username: string }
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [typed, setTyped] = useState("")
  const purge = trpc.admin.purgeUser.useMutation({
    onSuccess: () => {
      toast.success(t("admin_purged"))
      void utils.admin.deletedUsers.invalidate()
      void utils.admin.overview.invalidate()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message in ERROR_KEY ? t(ERROR_KEY[e.message as keyof typeof ERROR_KEY]) : e.message),
  })
  const label = t("admin_purge_confirm_label").replace("{username}", user.username)

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin_purge_title").replace("{username}", user.username)}</AlertDialogTitle>
          <AlertDialogDescription>{t("admin_purge_desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="purge-confirm">{label}</Label>
          <Input
            id="purge-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 md:h-10"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-10" disabled={purge.isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-red-600 hover:bg-red-700 md:h-10"
            disabled={typed !== user.username || purge.isPending}
            onClick={(e) => {
              e.preventDefault()
              purge.mutate({ userId: user.id, confirmUsername: typed })
            }}
          >
            {t("admin_purge")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
