"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

export function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  // Chỉ giữ trong state của dialog: đóng là mất, không có đường xem lại (spec N R1).
  const [temp, setTemp] = useState<string | null>(null)
  const mut = trpc.admin.resetPassword.useMutation({
    onSuccess: (r) => setTemp(r.tempPassword),
    onError: (e) => toast.error(e.message),
  })

  const copy = async () => {
    if (!temp) return
    try {
      await navigator.clipboard.writeText(temp)
      toast.success(t("plan_copied"))
    } catch {
      // Trình duyệt chặn clipboard: mật khẩu vẫn hiện để tự chọn.
    }
  }

  // Đóng lúc đang chạy là mất mật khẩu tạm vừa sinh (không có đường xem lại).
  return (
    <AlertDialog open onOpenChange={(open) => !open && !mut.isPending && onClose()}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{`${t("admin_reset_password")} · ${user.username}`}</AlertDialogTitle>
          <AlertDialogDescription>
            {temp ? t("admin_reset_done") : t("admin_reset_confirm").replace("{username}", user.username)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {temp && (
          <div className="flex items-center gap-2">
            <code
              data-testid="temp-password"
              className="flex-1 select-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-base text-foreground"
            >
              {temp}
            </code>
            <Button type="button" variant="outline" className="h-11 md:h-10" onClick={copy}>
              {t("copy_link")}
            </Button>
          </div>
        )}
        <AlertDialogFooter>
          {temp ? (
            <Button type="button" className="h-11 md:h-10" onClick={onClose}>
              {t("admin_reset_close")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onClose} disabled={mut.isPending}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                className="h-11 md:h-10"
                onClick={() => mut.mutate({ userId: user.id })}
                disabled={mut.isPending}
              >
                {t("admin_reset_password")}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
