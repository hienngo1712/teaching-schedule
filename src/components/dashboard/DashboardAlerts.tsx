"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { CalendarClock, CalendarX, Wallet } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog"
import { SessionFormDialog } from "@/components/sessions/SessionFormDialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { formatCurrency, formatDate, formatDayOfWeek } from "@/lib/utils"
import type { SessionDTO, SessionListDTO } from "@/lib/types/models"

type Alerts = RouterOutputs["report"]["alerts"]
type UnrescheduledSession = Omit<Alerts["unrescheduled"][number], "sessionDate"> & { sessionDate: Date }

const PREVIEW_COUNT = 3
const ROW_CLASS = "flex min-h-11 w-full items-center gap-3 py-2 text-left"

type AlertGroupProps<T> = {
  testId: string
  icon: ReactNode
  title: string
  description: string
  items: T[]
  getKey: (item: T) => number
  renderRow: (item: T) => ReactNode
}

function AlertGroup<T>({ testId, icon, title, description, items, getKey, renderRow }: AlertGroupProps<T>) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT)

  return (
    <Card data-testid={testId} className="min-w-0 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</h3>
        <Badge variant="secondary" className="border-none bg-primary/[0.08] text-primary hover:bg-primary/[0.08]">
          {items.length}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {visible.map((item) => (
          <li key={getKey(item)} data-testid="alert-row">
            {renderRow(item)}
          </li>
        ))}
      </ul>
      {items.length > PREVIEW_COUNT && (
        <Button variant="ghost" className="mt-1 h-11 w-full md:h-10" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t("show_less_stats") : t("alert_view_all").replace("{n}", String(items.length))}
        </Button>
      )}
    </Card>
  )
}

export function DashboardAlerts() {
  const { t } = useTranslation()
  const query = trpc.report.alerts.useQuery()

  const [selected, setSelected] = useState<SessionListDTO | undefined>()
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editing, setEditing] = useState<SessionDTO | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  const unrescheduled = useMemo<UnrescheduledSession[]>(
    () => (query.data?.unrescheduled ?? []).map((s) => ({ ...s, sessionDate: new Date(s.sessionDate) })),
    [query.data]
  )

  if (query.isPending) return <Skeleton className="h-24 w-full rounded-lg" />

  // Lỗi hoặc không có gì cần xử lý → ẩn cả khối (spec S10).
  const data = query.data
  const hasAlerts =
    !!data && (data.debts.length > 0 || data.idleStudents.length > 0 || unrescheduled.length > 0)

  return (
    <>
      {data && hasAlerts && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">{t("alerts_title")}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AlertGroup
              testId="alert-group-debt"
              icon={<Wallet className="size-4 shrink-0 text-muted-foreground" />}
              title={t("alert_debt_title")}
              description={t("alert_debt_desc")}
              items={data.debts}
              getKey={(d) => d.studentId}
              renderRow={(d) => (
                <Link
                  href={`/tuition?${new URLSearchParams({
                    year: String(data.year),
                    month: String(data.month),
                    studentName: d.fullName,
                    studentId: String(d.studentId),
                  })}`}
                  className={ROW_CLASS}
                >
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium text-slate-900">{d.fullName}</span>
                    <span className="text-slate-500"> · {t("grade")} {d.grade}</span>
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold text-debt">{formatCurrency(d.amount)}</p>
                    <p className="whitespace-nowrap text-xs text-slate-500">
                      {t("alert_debt_months").replace("{n}", d.months >= 12 ? "12+" : String(d.months))}
                    </p>
                  </div>
                </Link>
              )}
            />
            <AlertGroup
              testId="alert-group-idle"
              icon={<CalendarX className="size-4 shrink-0 text-muted-foreground" />}
              title={t("alert_idle_title")}
              description={t("alert_idle_desc")}
              items={data.idleStudents}
              getKey={(s) => s.studentId}
              renderRow={(s) => (
                <Link href="/calendar" className={ROW_CLASS}>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium text-slate-900">{s.fullName}</span>
                    <span className="text-slate-500"> · {t("grade")} {s.grade}</span>
                  </p>
                </Link>
              )}
            />
            <AlertGroup
              testId="alert-group-unrescheduled"
              icon={<CalendarClock className="size-4 shrink-0 text-muted-foreground" />}
              title={t("alert_unrescheduled_title")}
              description={t("alert_unrescheduled_desc")}
              items={unrescheduled}
              getKey={(s) => s.id}
              renderRow={(s) => (
                <button
                  type="button"
                  className={ROW_CLASS}
                  onClick={() => {
                    setSelected(s)
                    setIsDetailOpen(true)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {formatDate(s.sessionDate)} {formatDayOfWeek(s.sessionDate)} · {s.startTime} · {s.subject.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {s.students.map((st) => st.fullName).join(", ")}
                    </p>
                  </div>
                </button>
              )}
            />
          </div>
        </section>
      )}

      {/* Dialog nằm ngoài khối: Khôi phục ca cuối cùng làm khối biến mất nhưng dialog không bị unmount giữa chừng. */}
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
    </>
  )
}
