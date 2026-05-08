"use client"

import { MonthCalendar } from "@/components/calendar/MonthCalendar"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function CalendarPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">{t("calendar")}</h1>
      <MonthCalendar />
    </div>
  )
}
