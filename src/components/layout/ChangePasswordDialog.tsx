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

export function ChangePasswordDialog({
  trigger,
}: {
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleSuccess(relogin: boolean) {
    setOpen(false)
    if (relogin) {
      toast.success("Đổi mật khẩu thành công, vui lòng đăng nhập lại")
      router.replace("/login")
      return
    }
    toast.success("Đổi mật khẩu thành công")
    // Nạp lại layout để SessionProvider nhận phiên mới vừa cấp.
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
          <DialogDescription>
            Mật khẩu mới tối thiểu 10 ký tự.
          </DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
