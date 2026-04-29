"use client"

import type { SessionDTO } from "@/server/services/session.service"
import { getLevel } from "@/lib/utils"
import { cn } from "@/lib/utils"

type Props = {
  session: SessionDTO
  onClick?: (session: SessionDTO) => void
}

function deriveLevel(session: SessionDTO): "tieu_hoc" | "thcs" | "mixed" {
  if (session.students.length === 0) return "tieu_hoc"
  const levels = session.students.map((s) => getLevel(s.grade))
  const allTieuHoc = levels.every((l) => l === "tieu_hoc")
  const allThcs = levels.every((l) => l === "thcs")
  if (allTieuHoc) return "tieu_hoc"
  if (allThcs) return "thcs"
  return "mixed"
}

export function SessionCard({ session, onClick }: Props) {
  const level = deriveLevel(session)
  const label = session.title ?? session.subject.name
  const studentCountText =
    session.studentCount > 0 ? `· ${session.studentCount} HS` : ""

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
