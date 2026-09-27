"use client"

import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ChangePasswordForm } from "@/components/layout/ChangePasswordForm"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function ForcedChangePassword() {
  const router = useRouter()
  const { t } = useTranslation()

  function handleSuccess(relogin: boolean) {
    router.replace(relogin ? "/login" : "/dashboard")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">{t("must_change_password_title")}</h1>
        <p className="text-sm text-slate-500">{t("must_change_password_desc")}</p>
      </div>
      <ChangePasswordForm onSuccess={handleSuccess} />
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full md:h-10"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        {t("logout")}
      </Button>
    </div>
  )
}
