"use client"

import { useMemo, useState } from "react"
import dayjs from "dayjs"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { SessionListItem } from "@/components/calendar/SessionListItem"
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog"
import { SessionFormDialog } from "@/components/sessions/SessionFormDialog"
import { filterTodaySessions } from "@/lib/today-sessions"
import type { SessionDTO, SessionListDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

type SessionWithDate = Omit<RouterOutputs["session"]["getMonth"][number], "sessionDate"> & { sessionDate: Date }

export function TodaySessions() {
  const { t } = useTranslation()
  const now = dayjs()
  const today = now.format("YYYY-MM-DD")

  const query = trpc.session.getMonth.useQuery({ year: now.year(), month: now.month() + 1 })

  const sessions = useMemo<SessionWithDate[]>(
    () =>
      filterTodaySessions(
        (query.data ?? []).map((s) => ({ ...s, sessionDate: new Date(s.sessionDate) })),
        today
      ),
    [query.data, today]
  )

  const [selected, setSelected] = useState<SessionListDTO | undefined>()
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editing, setEditing] = useState<SessionDTO | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{t("sessions_today")}</h2>

      {query.isPending ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white py-8 text-center text-sm text-slate-500">
          {t("no_sessions_today")}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              onClick={(session) => {
                setSelected(session)
                setIsDetailOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {selected && (
        <SessionDetailDialog
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          session={selected}
          onEdit={(session) => {
            setIsDetailOpen(false)
            setEditing(session)
            setIsFormOpen(true)
          }}
        />
      )}

      <SessionFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} editingSession={editing} />
    </section>
  )
}
