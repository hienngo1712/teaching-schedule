"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Camera, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FilterBar } from "@/components/common/FilterBar"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { StatCard } from "@/components/common/StatCard"
import { LockedSection } from "@/components/plan/LockedSection"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useExport } from "@/hooks/useExport"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { trpc } from "@/lib/trpc"
import { PLAN_LABEL } from "@/lib/plans"
import { cn, formatCurrency, formatDayOfWeek } from "@/lib/utils"
import {
  exportTimesheetExcel,
  formatHours,
  kindLabel,
  sessionAmount,
  type TimesheetRow,
  type Tr,
} from "@/lib/timesheet-export"

const PAGE = 20
const ALL = "all"
// Công tắc "Kèm số tiền": tắt sẵn, nhớ trong phiên (spec AM §4.1).
const MONEY_KEY = "timesheet-with-money"

const KIND_CLASS: Record<string, string> = {
  done: "border-none bg-success-soft text-success hover:bg-success-soft",
  makeup: "border-none bg-primary/[0.08] text-primary hover:bg-primary/[0.08]",
  upcoming: "border-slate-200 bg-white text-slate-500 hover:bg-white",
  cancelled: "border-none bg-slate-100 text-slate-500 hover:bg-slate-100",
}

function readMoney() {
  try {
    return sessionStorage.getItem(MONEY_KEY) === "1"
  } catch {
    return false
  }
}

// Tab Bảng công (mẫu 08): gói Plus. Chọn 1 nơi theo ca/giờ hoặc "Tất cả nơi".
export function TimesheetTab({ year, month, period }: { year: number; month: number; period: ReactNode }) {
  const { t } = useTranslation()
  const tr = t as unknown as Tr
  const { data: session } = useSession()
  const gate = useFeatureGate("timesheet")
  const { places } = usePlaceSummary()
  const perSession = places.filter((p) => p.billing === "per_session")
  const [picked, setPicked] = useState<string | null>(null)
  const placeValue = picked ?? (perSession[0] ? String(perSession[0].id) : ALL)
  const placeId = placeValue === ALL ? undefined : Number(placeValue)
  const [showAll, setShowAll] = useState(false)
  const [withMoney, setWithMoney] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const { captureElement, isCapturing } = useExport()

  useEffect(() => setWithMoney(readMoney()), [])
  useEffect(() => setShowAll(false), [placeValue, year, month])

  const query = trpc.timesheet.month.useQuery({ placeId, year, month }, { enabled: gate.allowed })
  // Đơn giá để tính cột tiền: chỉ khi chọn 1 nơi.
  const detail = trpc.income.detail.useQuery({ placeId: placeId ?? 0, year, month }, { enabled: gate.allowed && placeId !== undefined })
  const line = placeId !== undefined ? detail.data?.lines[0] : undefined
  const rate = line ? { unit: line.unit, amount: line.amount } : null
  const money = withMoney && rate !== null

  const data = query.data
  const stats = data?.stats
  const sessions = data?.sessions ?? []
  const visible = showAll ? sessions : sessions.slice(0, PAGE)
  const placeName = data?.place?.name ?? t("all_places")
  const teacherName = session?.user?.fullName || t("teacher_fallback")
  const title = t("ts_card_title").replace("{month}", String(month)).replace("{year}", String(year))
  const totalLine = stats
    ? t("ts_total").replace("{count}", String(stats.doneCount)).replace("{hours}", formatHours(stats.doneHours))
    : ""
  const filename = `bang-cong-${year}-${String(month).padStart(2, "0")}`

  const toggleMoney = (v: boolean) => {
    setWithMoney(v)
    try {
      sessionStorage.setItem(MONEY_KEY, v ? "1" : "0")
    } catch {
      // Không lưu được thì chỉ nhớ trong trang.
    }
  }

  const kindBadge = (s: TimesheetRow) => {
    const k = s.kind === "done" && s.isMakeup ? "makeup" : s.kind
    return <Badge className={cn("whitespace-nowrap", KIND_CLASS[k])}>{kindLabel(s, tr)}</Badge>
  }
  const dateLabel = (s: TimesheetRow) => `${formatDayOfWeek(`${s.date}T00:00:00.000Z`)} · ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`

  const columns: Column<TimesheetRow>[] = [
    { header: t("stt"), cell: (_, i) => i + 1, className: "w-[56px] text-center text-slate-400" },
    { header: t("ts_col_date"), cell: dateLabel, className: "whitespace-nowrap" },
    { header: t("ts_col_time"), cell: (s) => `${s.start}–${s.end}`, className: "whitespace-nowrap" },
    { header: t("ts_col_subject"), cell: (s) => (s.title ? `${s.subject} – ${s.title}` : s.subject) },
    { header: t("ts_col_hours"), cell: (s) => (s.kind === "cancelled" ? "–" : formatHours(s.hours)), className: "text-right tabular-nums" },
    { header: t("ts_col_present"), cell: (s) => (s.kind === "done" ? `${s.presentCount}/${s.totalCount}` : "–"), className: "text-center tabular-nums" },
    {
      header: t("ts_col_status"),
      cell: (s) => (
        <div className="space-y-0.5">
          {kindBadge(s)}
          {s.cancelReason && <p className="text-xs text-slate-500">{s.cancelReason}</p>}
        </div>
      ),
    },
    ...(money
      ? [
          {
            header: t("ts_col_amount"),
            cell: (s: TimesheetRow) => {
              const a = sessionAmount(s, rate!)
              return a === null ? "–" : formatCurrency(a)
            },
            className: "whitespace-nowrap text-right tabular-nums",
          },
        ]
      : []),
  ]

  const statCards = (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard
        label={t("ts_done")}
        value={stats && t("ts_count").replace("{n}", String(stats.doneCount))}
        hint={stats && t("ts_hours").replace("{h}", formatHours(stats.doneHours))}
        loading={gate.allowed && query.isPending}
      />
      <StatCard label={t("ts_makeup")} value={stats && t("ts_count").replace("{n}", String(stats.makeupCount))} hint={t("ts_makeup_hint")} loading={gate.allowed && query.isPending} />
      <StatCard
        label={t("ts_cancelled")}
        value={stats && t("ts_count").replace("{n}", String(stats.cancelledCount))}
        hint={t("ts_cancelled_hint")}
        loading={gate.allowed && query.isPending}
      />
      <StatCard
        label={t("ts_scheduled")}
        value={stats && t("ts_count").replace("{n}", String(stats.scheduledCount))}
        hint={t("ts_scheduled_hint")}
        loading={gate.allowed && query.isPending}
      />
    </div>
  )

  if (gate.locked) {
    return (
      <LockedSection plan={gate.requiredPlan} label={t("plan_available_in").replace("{plan}", PLAN_LABEL[gate.requiredPlan])} testId="timesheet-locked">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {[t("ts_done"), t("ts_makeup"), t("ts_cancelled"), t("ts_scheduled")].map((l) => (
            <StatCard key={l} label={l} value="0" />
          ))}
        </div>
      </LockedSection>
    )
  }

  return (
    <div className="space-y-4">
      <FilterBar
        period={period}
        primaryFilter={
          <Select value={placeValue} onValueChange={(v) => v && setPicked(v)}>
            <SelectTrigger aria-label={t("session_place")} className="h-11 w-auto max-w-[60vw] gap-2 md:h-10 md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("all_places")}</SelectItem>
              {perSession.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        moreActions={[
          {
            key: "excel",
            label: t("export_excel"),
            icon: <FileSpreadsheet className="size-4" />,
            disabled: !data,
            onSelect: () => {
              if (!data) return
              exportTimesheetExcel({
                data,
                title,
                subtitle: `${placeName} · ${t("ts_teacher").replace("{name}", teacherName)}`,
                totalLine,
                withMoney: money,
                rate,
                filename,
                t: tr,
              }).catch(() => toast.error(t("load_error")))
            },
          },
          {
            key: "image",
            label: t("ts_export_image"),
            icon: <Camera className="size-4" />,
            disabled: !data || isCapturing,
            onSelect: () => {
              // Ảnh cần đủ dòng: mở hết rồi mới chụp.
              setShowAll(true)
              setTimeout(() => captureElement(exportRef.current, filename), 50)
            },
          },
        ]}
        moreContent={
          rate && (
            <div className="flex min-h-11 items-center gap-3 px-2 py-2">
              <Checkbox id="ts-with-money" checked={withMoney} onCheckedChange={(v) => toggleMoney(v === true)} />
              <Label htmlFor="ts-with-money" className="cursor-pointer text-sm font-normal">
                {t("ts_with_money")}
              </Label>
            </div>
          )
        }
      />

      {data && data.unassignedCount > 0 && (
        <div data-testid="ts-unassigned" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{t("ts_unassigned").replace("{n}", String(data.unassignedCount))}</span>
          <Link href={`/calendar?year=${year}&month=${month}`} className="font-semibold text-amber-900 underline underline-offset-2">
            {t("ts_unassigned_action")}
          </Link>
        </div>
      )}

      {statCards}

      <Card ref={exportRef}>
        <CardHeader className="rounded-t-lg border-b bg-slate-50">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm text-slate-500">
            {placeName} · {t("ts_teacher").replace("{name}", teacherName)}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 p-3 md:p-4">
          <ResponsiveList
            items={visible}
            getKey={(s) => s.id}
            columns={columns}
            isLoading={query.isPending}
            isError={query.isError}
            onRetry={() => query.refetch()}
            errorText={t("load_error")}
            retryText={t("retry")}
            emptyText={t("ts_empty")}
            renderCard={(s) => (
              <div className="rounded-lg border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {dateLabel(s)} · {s.start}–{s.end}
                    </p>
                    <p className="truncate text-sm text-slate-500">{s.title ? `${s.subject} – ${s.title}` : s.subject}</p>
                  </div>
                  {kindBadge(s)}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {s.kind === "cancelled"
                    ? s.cancelReason ?? t("ts_cancelled_hint")
                    : `${t("ts_hours").replace("{h}", formatHours(s.hours))}${s.kind === "done" ? ` · ${s.presentCount}/${s.totalCount} ${t("ts_col_present")}` : ""}`}
                  {money && sessionAmount(s, rate!) !== null && ` · ${formatCurrency(sessionAmount(s, rate!))}`}
                </p>
              </div>
            )}
          />
          {!showAll && sessions.length > PAGE && (
            <Button variant="ghost" className="export-hide h-11 w-full" onClick={() => setShowAll(true)}>
              {t("ts_show_more").replace("{n}", String(sessions.length - PAGE))}
            </Button>
          )}
          {stats && (
            <p className="border-t pt-3 text-sm font-semibold text-slate-900">
              {totalLine}
              {money && detail.data?.expected != null && ` · ${formatCurrency(detail.data.expected)}`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
