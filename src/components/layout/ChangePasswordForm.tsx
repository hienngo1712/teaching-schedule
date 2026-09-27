"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { changePasswordAction } from "@/app/actions/change-password"

// Dùng chung cho dialog trong menu tài khoản và trang đổi mật khẩu bắt buộc (spec N R2).
export function ChangePasswordForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (relogin: boolean) => void
  onCancel?: () => void
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 10) {
      setError("Mật khẩu mới phải có ít nhất 10 ký tự")
      return
    }
    if (next === current) {
      setError("Mật khẩu mới phải khác mật khẩu hiện tại")
      return
    }
    if (next !== confirm) {
      setError("Xác nhận mật khẩu không khớp")
      return
    }
    startTransition(async () => {
      const r = await changePasswordAction({ currentPassword: current, newPassword: next })
      if (r.ok) onSuccess(r.relogin === true)
      else if (r.error === "UNAUTHORIZED") setError("Phiên đăng nhập đã hết, vui lòng đăng nhập lại")
      else setError(r.message ?? "Mật khẩu hiện tại không đúng")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current-pw">Mật khẩu hiện tại</Label>
        <PasswordInput
          id="current-pw"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pw">Mật khẩu mới</Label>
        <PasswordInput
          id="new-pw"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-pw">Xác nhận mật khẩu mới</Label>
        <PasswordInput
          id="confirm-pw"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onCancel} disabled={isPending}>
            Hủy
          </Button>
        )}
        <Button type="submit" className="h-11 md:h-10" disabled={isPending}>
          {isPending ? "Đang lưu..." : "Đổi mật khẩu"}
        </Button>
      </div>
    </form>
  )
}
