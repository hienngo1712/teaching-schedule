"use client"

import Link from "next/link"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Gõ thẳng /tuition hoặc /reports khi chỉ dạy nơi tính theo ca/giờ (spec AL §4.4).
export function NoPerStudentPlace({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <div data-testid="no-per-student-place" className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
        <MapPin className="mx-auto size-8 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm text-slate-600">{t("no_per_student_place")}</p>
        <Button asChild className="mt-4 h-11 md:h-10">
          <Link href="/places">{t("open_places")}</Link>
        </Button>
      </div>
    </div>
  )
}
