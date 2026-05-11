"use client"

import type { SessionListDTO } from "@/lib/types/models"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  session: SessionListDTO
  onClick?: (session: SessionListDTO) => void
}

export function SessionCard({ session, onClick }: Props) {
  const { t } = useTranslation()
  const level = session.level
  const label = session.title ?? session.subject.name
  const studentCountText =
    session.studentCount > 0 ? `· ${session.studentCount} ${t("student_abbrev")}` : ""

  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={cn(
        "session-card text-left w-full",
        level === "tieu_hoc" && "session-card--tieu-hoc",
        level === "thcs" && "session-card--thcs",
        level === "mixed" && "border-indigo-500 bg-indigo-50"
      )}
      title={`${session.startTime}–${session.endTime} · ${session.subject.name}`}
    >
      <div className="font-medium text-slate-900">
        {session.startTime}–{session.endTime}
      </div>
      <div className="truncate text-slate-700">
        {label} {studentCountText}
      </div>
    </button>
  )
}
