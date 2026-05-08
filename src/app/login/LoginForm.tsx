"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { loginAction, type LoginResult } from "./actions"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const { t } = useTranslation()

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ERROR_MESSAGES: Record<
    Exclude<LoginResult, { ok: true }>["error"],
    string
  > = {
    MISSING_FIELDS: t("missing_fields"),
    INVALID_CREDENTIALS: t("invalid_credentials"),
    RATE_LIMITED: t("rate_limited_msg"),
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await loginAction(formData)
      if (result.ok) {
        router.replace(callbackUrl)
        router.refresh()
      } else {
        setError(ERROR_MESSAGES[result.error])
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">{t("username")}</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("logging_in") : t("login")}
      </Button>

      <div className="text-center text-sm">
        <span className="text-slate-500">{t("no_account")}{" "}</span>
        <Link href="/register" className="text-indigo-600 hover:underline font-medium">
          {t("register_now")}
        </Link>
      </div>
    </form>
  )
}
