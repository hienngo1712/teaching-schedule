"use client"

import { MonthCalendar } from "@/components/calendar/MonthCalendar"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function CalendarPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <PageHeader title={t("calendar")} />
      <MonthCalendar />
    </div>
  )
}
