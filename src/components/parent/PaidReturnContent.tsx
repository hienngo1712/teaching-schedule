"use client"

import { CircleCheck } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function PaidReturnContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center text-slate-700">
      <CircleCheck aria-hidden className="size-12 text-primary" />
      <h1 className="text-xl font-semibold text-slate-900">{t("paid_return_title")}</h1>
      <p className="leading-relaxed">{t("paid_return_body")}</p>
    </main>
  )
}
