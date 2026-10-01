"use client"

import dayjs from "dayjs"
import type { SessionListDTO } from "@/lib/types/models"
import { cn } from "@/lib/utils"
import { getSessionLabel } from "@/lib/session-label"
import { formatGrades } from "@/lib/format-grades"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  session: SessionListDTO
  onClick?: (session: SessionListDTO) => void
}

export function SessionCard({ session, onClick }: Props) {
  const { t } = useTranslation()
  const level = session.level
  const label = getSessionLabel(session)
  const metaOf = (short: boolean) =>
    [
      label,
      formatGrades(session.grades ?? [], t("grade"), short),
      session.studentCount > 0 ? `${session.studentCount} ${t("student_abbrev")}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  const isCancelled = session.status === "cancelled"
  const isMakeup = session.makeupOfId != null

  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={cn(
        "session-card text-left w-full",
        // .session-card--* nằm ngoài @layer nên đè utility đỏ, tailwind-merge không gỡ được: ca huỷ không gắn màu cấp.
        !isCancelled && level === "tieu_hoc" && "session-card--tieu-hoc",
        !isCancelled && level === "thcs" && "session-card--thcs",
        !isCancelled && level === "thpt" && "session-card--thpt",
        !isCancelled && level === "mixed" && "border-slate-500 bg-slate-100",
        isCancelled && "opacity-60 border-red-300 bg-red-50"
      )}
      title={`${session.startTime}–${session.endTime} · ${session.subject.name}`}
    >
      <div className={cn("font-medium text-slate-900", isCancelled && "line-through text-red-700")}>
        {session.startTime}–{session.endTime}
      </div>
      <div className={cn("truncate text-slate-700", isCancelled && "line-through")}>
        <span className="md:hidden">{metaOf(true)}</span>
        <span className="hidden md:inline">{metaOf(false)}</span>
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
        <div className="text-[10px] font-semibold text-primary">
          {t("makeup_session")}
          {session.originalInfo
            ? ` · ${t("from_date").replace("{date}", dayjs(session.originalInfo.sessionDate).format("DD/MM"))}`
            : ""}
        </div>
      )}
    </button>
  )
}
