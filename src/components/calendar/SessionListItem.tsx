"use client"

import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getSessionLabel } from "@/lib/session-label"
import type { SessionListDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  session: SessionListDTO
  onClick: (session: SessionListDTO) => void
}

export function SessionListItem({ session, onClick }: Props) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => onClick(session)}
      className="flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all active:scale-[0.98]"
    >
      <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: session.subject.color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-slate-900">{getSessionLabel(session)}</div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1 rounded bg-primary/[0.08] px-1.5 py-0.5 font-medium text-primary">
            <Clock className="size-3" />
            {session.startTime} - {session.endTime}
          </div>
          <span className="text-slate-300">|</span>
          <span className="font-medium">{session.studentCount} {t("students")}</span>
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0 text-[10px] font-bold">
        {t("details")}
      </Badge>
    </button>
  )
}
