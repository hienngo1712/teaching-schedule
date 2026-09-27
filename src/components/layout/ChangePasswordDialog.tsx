"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ChangePasswordForm } from "./ChangePasswordForm"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function ChangePasswordDialog({
  trigger,
}: {
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  function handleSuccess(relogin: boolean) {
    setOpen(false)
    if (relogin) {
      toast.success(t("cp_success_relogin"))
      router.replace("/login")
      return
    }
    toast.success(t("cp_success"))
    // Nạp lại layout để SessionProvider nhận phiên mới vừa cấp.
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("change_password")}</DialogTitle>
          <DialogDescription>{t("cp_hint")}</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
