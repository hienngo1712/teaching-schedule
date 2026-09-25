"use client"

import dayjs from "dayjs"
import type { SessionListDTO } from "@/lib/types/models"
import { cn } from "@/lib/utils"
import { getSessionLabel } from "@/lib/session-label"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  session: SessionListDTO
  onClick?: (session: SessionListDTO) => void
}

export function SessionCard({ session, onClick }: Props) {
  const { t } = useTranslation()
  const level = session.level
  const label = getSessionLabel(session)
  const studentCountText =
    session.studentCount > 0 ? `· ${session.studentCount} ${t("student_abbrev")}` : ""
  const isCancelled = session.status === "cancelled"
  const isMakeup = session.makeupOfId != null

  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={cn(
        "session-card text-left w-full",
        level === "tieu_hoc" && "session-card--tieu-hoc",
        level === "thcs" && "session-card--thcs",
        level === "mixed" && "border-indigo-500 bg-indigo-50",
        isCancelled && "opacity-60 border-red-300 bg-red-50"
      )}
      title={`${session.startTime}–${session.endTime} · ${session.subject.name}`}
    >
      <div className={cn("font-medium text-slate-900", isCancelled && "line-through text-red-700")}>
        {session.startTime}–{session.endTime}
      </div>
      <div className={cn("truncate text-slate-700", isCancelled && "line-through")}>
        {label} {studentCountText}
      </div>
      {isCancelled && (
        <div className="text-[10px] font-semibold text-red-600">
          {t("cancelled_label")}
          {session.makeupInfo
            ? ` · ${t("makeup_on").replace("{date}", dayjs(session.makeupInfo.sessionDate).format("DD/MM"))}`
            : ""}
        </div>
      )}
      {isMakeup && !isCancelled && (
        <div className="text-[10px] font-semibold text-indigo-600">
          {t("makeup_session")}
          {session.originalInfo
            ? ` · ${t("from_date").replace("{date}", dayjs(session.originalInfo.sessionDate).format("DD/MM"))}`
            : ""}
        </div>
      )}
    </button>
  )
}
