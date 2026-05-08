"use client"

import { StudentList } from "@/components/students/StudentList"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function StudentsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">{t("students")}</h1>
      <StudentList />
    </div>
  )
}
