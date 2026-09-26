"use client"

import { PageHeader } from "@/components/common/PageHeader"
import { BankAccountCard } from "@/components/settings/BankAccountCard"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("settings")} />
      <BankAccountCard />
    </div>
  )
}
