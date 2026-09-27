"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { changePasswordAction } from "@/app/actions/change-password"
import { useTranslation } from "@/components/providers/LanguageProvider"

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
  const { t } = useTranslation()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 10) {
      setError(t("cp_err_min"))
      return
    }
    if (next === current) {
      setError(t("cp_err_same"))
      return
    }
    if (next !== confirm) {
      setError(t("cp_err_mismatch"))
      return
    }
    startTransition(async () => {
      const r = await changePasswordAction({ currentPassword: current, newPassword: next })
      if (r.ok) onSuccess(r.relogin === true)
      else if (r.error === "UNAUTHORIZED") setError(t("cp_err_session"))
      else if (r.error === "RATE_LIMITED") setError(t("cp_err_rate_limited"))
      // Không hiện r.message: chuỗi zod phía server chỉ có tiếng Việt.
      else if (r.error === "INVALID") setError(t("cp_err_invalid"))
      else setError(t("cp_err_wrong_current"))
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current-pw">{t("cp_current")}</Label>
        <PasswordInput
          id="current-pw"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pw">{t("cp_new")}</Label>
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
        <Label htmlFor="confirm-pw">{t("cp_confirm")}</Label>
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
            {t("cancel")}
          </Button>
        )}
        <Button type="submit" className="h-11 md:h-10" disabled={isPending}>
          {isPending ? t("saving") : t("change_password")}
        </Button>
      </div>
    </form>
  )
}
