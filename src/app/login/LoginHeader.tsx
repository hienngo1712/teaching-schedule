"use client"

import { CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function LoginHeader() {
  const { t } = useTranslation()
  
  return (
    <CardHeader className="text-center space-y-2">
      <div className="flex justify-center">
        <div className="size-12 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="size-6 text-white" />
        </div>
      </div>
      <CardTitle className="text-xl">{t("app")}</CardTitle>
      <p className="text-sm text-slate-500">{t("login_to_continue")}</p>
    </CardHeader>
  )
}
