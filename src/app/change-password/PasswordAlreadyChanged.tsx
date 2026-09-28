"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Cookie cũ còn cờ bắt đổi mật khẩu nên middleware luôn đưa về đây; chỉ đăng nhập lại mới làm mới cookie.
export function PasswordAlreadyChanged() {
  const { t } = useTranslation()
  return (
    <div data-testid="password-already-changed" className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">{t("password_already_changed_title")}</h1>
        <p className="text-sm text-slate-500">{t("password_already_changed_desc")}</p>
      </div>
      <Button type="button" className="h-11 w-full md:h-10" onClick={() => signOut({ callbackUrl: "/login" })}>
        {t("relogin")}
      </Button>
    </div>
  )
}
