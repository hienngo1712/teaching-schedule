"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, type LoginResult } from "./actions"

const ERROR_MESSAGES: Record<
  Exclude<LoginResult, { ok: true }>["error"],
  string
> = {
  MISSING_FIELDS: "Vui lòng nhập tên đăng nhập và mật khẩu.",
  // Không nói rõ username có tồn tại hay không
  INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu không đúng.",
  RATE_LIMITED:
    "Tài khoản tạm khóa 15 phút do đăng nhập sai nhiều lần. Vui lòng thử lại sau.",
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/calendar"

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
        <Label htmlFor="username">Tên đăng nhập</Label>
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
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
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
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  )
}
