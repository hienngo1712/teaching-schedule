"use client"

import { useEffect, useMemo, useState } from "react"
import { keepPreviousData } from "@tanstack/react-query"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useDebounce } from "@/hooks/useDebounce"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { DAY_NAMES } from "@/lib/constants"
import {
  COPY_MONTH_MAX_MONTHS,
  COPY_MONTH_MAX_SESSIONS,
  monthFromIndex,
  monthIndex,
  shiftMonth,
  targetMonths,
  type MonthRef,
} from "@/lib/copy-month"
import { planRequiredOf } from "@/lib/plans"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { cn, vnDateParts } from "@/lib/utils"

type Preview = RouterOutputs["session"]["copyMonthPreview"]
type PatternPreview = Preview["patterns"][number]
type ConflictPreview = Preview["conflicts"][number]
type CopyResult = RouterOutputs["session"]["copyMonth"]
type Skipped = { existing: number; conflict: number; past: number }

const KIND_KEY = {
  single: "copy_kind_single",
  stopped: "copy_kind_stopped",
  biweekly: "copy_kind_biweekly",
  no_students: "copy_kind_no_students",
} as const
const MONTH_CHOICES = Array.from({ length: COPY_MONTH_MAX_MONTHS }, (_, i) => i + 1)

const refValue = (m: MonthRef) => `${m.year}-${m.month}`
const parseRef = (v: string): MonthRef => {
  const [year, month] = v.split("-").map(Number)
  return { year, month }
}
const dayMonth = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`

// 12 tháng trước tới 6 tháng sau tháng hiện tại (giờ VN); luôn có tháng đang xem dù nằm ngoài khoảng.
function sourceOptions(initial: MonthRef): MonthRef[] {
  const now = monthIndex(vnDateParts())
  const idx = new Set(Array.from({ length: 19 }, (_, i) => now - 12 + i))
  idx.add(monthIndex(initial))
  return [...idx].sort((a, b) => a - b).map(monthFromIndex)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialYear: number
  initialMonth: number
  onViewMonth: (year: number, month: number) => void
}

export function CopyMonthDialog({ open, onOpenChange, initialYear, initialMonth, onViewMonth }: Props) {
  const { t } = useTranslation()
  const gate = useFeatureGate("copyMonth")
  const initial = { year: initialYear, month: initialMonth }
  const [source, setSource] = useState<MonthRef>(initial)
  const [from, setFrom] = useState<MonthRef>(() => shiftMonth(initial, 1))
  const [months, setMonths] = useState(1)
  // null = chưa chạm ô chọn → server chọn mặc định theo loại mẫu.
  const [picked, setPicked] = useState<string[] | null>(null)
  const debouncedPicked = useDebounce(picked, 300)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [options] = useState(() => sourceOptions(initial))

  const monthLabel = (m: MonthRef) =>
    t("month_year_label").replace("{month}", String(m.month)).replace("{year}", String(m.year))

  const preview = trpc.session.copyMonthPreview.useQuery(
    { source, from, months, ...(debouncedPicked ? { patternKeys: debouncedPicked } : {}) },
    { enabled: open && gate.allowed && result === null, placeholderData: keepPreviousData }
  )
  const data = preview.data

  // TRPCProvider chỉ bắt lỗi gói của mutation; query hết hạn gói giữa chừng phải tự đóng dialog.
  useEffect(() => {
    if (preview.error && planRequiredOf(preview.error)) {
      toast.error(preview.error.message)
      onOpenChange(false)
    }
  }, [preview.error, onOpenChange])

  // Mở lúc gói chưa tải xong: tải xong mới biết thiếu gói → chuyển sang popup nâng cấp.
  useEffect(() => {
    if (open && gate.locked) {
      gate.openUpgrade()
      onOpenChange(false)
    }
  }, [open, gate, onOpenChange])

  const copy = trpc.session.copyMonth.useMutation({
    onSuccess: (res) => {
      setResult(res)
      toast.success(t("copy_success").replace("{count}", String(res.created)))
    },
    onError: (err) => {
      toast.error(err.message)
      if (planRequiredOf(err)) onOpenChange(false)
      else void preview.refetch()
    },
  })

  const selectedKeys = picked ?? data?.patterns.filter((p) => p.selected).map((p) => p.key) ?? []
  const toggle = (key: string) =>
    setPicked(selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key])
  // Số "Tạo N ca" phải là số server vừa tính cho đúng lựa chọn đang gửi.
  const stale = picked !== debouncedPicked || preview.isFetching || preview.isPlaceholderData
  const created = data?.totals.created ?? 0
  const overLimit = created > COPY_MONTH_MAX_SESSIONS
  const canConfirm = !!data && !preview.error && !stale && created > 0 && !overLimit && !copy.isPending

  const changeSource = (v: string) => {
    const next = parseRef(v)
    setSource(next)
    setFrom(shiftMonth(next, 1))
    setPicked(null)
  }
  const fromOptions = Array.from({ length: 12 }, (_, i) => shiftMonth(source, i + 1))
  const targets = targetMonths(from, months)
  const groups = useMemo(() => {
    const byDay = new Map<number, PatternPreview[]>()
    for (const p of data?.patterns ?? []) byDay.set(p.weekday, [...(byDay.get(p.weekday) ?? []), p])
    return [...byDay.entries()]
  }, [data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="copy-month-dialog"
        aria-describedby={undefined}
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-y-auto rounded-none p-0 sm:rounded-none md:h-auto md:max-h-[90dvh] md:max-w-2xl md:rounded-xl [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
      >
        <DialogHeader className="p-4 pr-14 text-left md:p-6 md:pr-14">
          <DialogTitle>{t("copy_month_title")}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div data-testid="copy-result" className="flex-1 space-y-4 px-4 pb-6 md:px-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 aria-hidden className="size-8 shrink-0 text-primary" />
              <p className="text-lg font-semibold">{t("copy_success").replace("{count}", String(result.created))}</p>
            </div>
            <ul className="space-y-0.5 text-sm text-slate-600">
              {result.months.map((m) => (
                <li key={refValue(m)}>{t("copy_month_count").replace("{month}", monthLabel(m)).replace("{count}", String(m.created))}</li>
              ))}
            </ul>
            <SkipLines skipped={result.skipped} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11 md:h-10" onClick={() => onOpenChange(false)}>
                {t("copy_close")}
              </Button>
              <Button
                className="h-11 md:h-10"
                onClick={() => {
                  onViewMonth(from.year, from.month)
                  onOpenChange(false)
                }}
              >
                {t("copy_view_month").replace("{month}", monthLabel(from))}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 px-4 pb-4 md:px-6">
              <section className="space-y-1.5">
                <p className="text-sm font-medium text-slate-700">{t("copy_source")}</p>
                <Select value={refValue(source)} onValueChange={changeSource}>
                  <SelectTrigger data-testid="copy-source" aria-label={t("copy_source")} className="h-11 md:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((m) => (
                      <SelectItem key={refValue(m)} value={refValue(m)}>
                        {monthLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("copy_source_hint")}</p>
              </section>

              <section className="space-y-1.5">
                <p className="text-sm font-medium text-slate-700">{t("copy_target")}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select value={refValue(from)} onValueChange={(v) => setFrom(parseRef(v))}>
                    <SelectTrigger data-testid="copy-from" aria-label={t("copy_from")} className="h-11 sm:w-56 md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fromOptions.map((m) => (
                        <SelectItem key={refValue(m)} value={refValue(m)}>
                          {monthLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div role="radiogroup" aria-label={t("copy_months_count")} className="grid grid-cols-3 gap-2 sm:w-44">
                    {MONTH_CHOICES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={months === n}
                        data-testid={`copy-months-${n}`}
                        onClick={() => setMonths(n)}
                        className={cn(
                          "h-11 rounded-md border text-sm font-medium md:h-10",
                          months === n ? "border-primary bg-primary/[0.08] text-primary" : "border-slate-200 text-slate-600"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  {targets.length > 1
                    ? `${monthLabel(targets[0])} → ${monthLabel(targets[targets.length - 1])}`
                    : monthLabel(targets[0])}
                </p>
              </section>

              <section data-testid="copy-preview" className="space-y-3">
                {preview.error ? (
                  <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-red-700">{preview.error.message}</p>
                    <Button variant="outline" className="h-11" onClick={() => void preview.refetch()}>
                      {t("retry")}
                    </Button>
                  </div>
                ) : !data ? (
                  <Skeleton className="h-40 w-full" />
                ) : data.patterns.length === 0 ? (
                  <p data-testid="copy-empty" className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                    {t("copy_empty").replace("{month}", monthLabel(source))}
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <p data-testid="copy-total" className="text-lg font-semibold text-slate-900">
                        {t("copy_will_create").replace("{count}", String(data.totals.created))}
                      </p>
                      <SkipLines skipped={data.totals} />
                      {overLimit && (
                        <p data-testid="copy-over-limit" className="mt-1 text-sm font-medium text-red-700">
                          {t("copy_over_limit").replace("{max}", String(COPY_MONTH_MAX_SESSIONS))}
                        </p>
                      )}
                      <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                        {data.months.map((m) => (
                          <li key={refValue(m)}>
                            {t("copy_month_count").replace("{month}", monthLabel(m)).replace("{count}", String(m.created))}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {groups.map(([weekday, list]) => (
                      <div key={weekday} className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">{DAY_NAMES[weekday]}</p>
                        {list.map((p) => (
                          <PatternRow
                            key={p.key}
                            p={p}
                            checked={selectedKeys.includes(p.key)}
                            onToggle={() => toggle(p.key)}
                            conflicts={data.conflicts.filter((c) => c.patternKey === p.key)}
                          />
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 md:justify-end md:px-6">
              <Button variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                data-testid="copy-confirm"
                className="h-11 flex-1 gap-2 md:h-10 md:flex-none"
                disabled={!canConfirm}
                onClick={() => copy.mutate({ source, from, months, patternKeys: selectedKeys })}
              >
                {copy.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {t("copy_confirm").replace("{count}", String(created))}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SkipLines({ skipped }: { skipped: Skipped }) {
  const { t } = useTranslation()
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {skipped.existing > 0 && <li className="text-slate-600">{t("copy_skip_existing").replace("{count}", String(skipped.existing))}</li>}
      {skipped.conflict > 0 && <li className="text-amber-700">{t("copy_skip_conflict").replace("{count}", String(skipped.conflict))}</li>}
      {skipped.past > 0 && <li className="text-slate-600">{t("copy_skip_past").replace("{count}", String(skipped.past))}</li>}
    </ul>
  )
}

function PatternRow({
  p,
  checked,
  onToggle,
  conflicts,
}: {
  p: PatternPreview
  checked: boolean
  onToggle: () => void
  conflicts: ConflictPreview[]
}) {
  const { t } = useTranslation()
  const [showConflicts, setShowConflicts] = useState(false)
  const conflictCount = p.perMonth.reduce((s, m) => s + m.conflict, 0)
  const kindKey = p.kind === "regular" ? null : KIND_KEY[p.kind]
  const time = `${p.startTime}–${p.endTime}`

  return (
    <div data-testid="copy-pattern" data-selected={checked} className="rounded-lg border">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 p-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`${DAY_NAMES[p.weekday]} ${time}`} className="mt-0.5" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
            <span>
              {DAY_NAMES[p.weekday]} · {time}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: p.subject.color }} />
              {p.subject.name}
            </span>
            {p.title && <span className="min-w-0 truncate text-slate-500">{p.title}</span>}
          </span>
          <span className="block text-xs text-slate-500">
            {t("copy_student_count").replace("{count}", String(p.studentCount))}
            {p.droppedInactive > 0 && ` · ${t("copy_dropped_inactive").replace("{count}", String(p.droppedInactive))}`}
            {" · "}
            {p.perMonth.map((m) => `${m.month}/${m.year}: ${p.selected ? m.created : m.slots}`).join(" · ")}
          </span>
          {kindKey && (
            <span data-testid="copy-pattern-kind" className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              {t(kindKey).replace("{date}", dayMonth(p.lastDate))}
            </span>
          )}
        </span>
      </label>
      {conflictCount > 0 && (
        <div className="border-t bg-red-50 px-3 py-1 text-xs text-red-700">
          <button
            type="button"
            aria-expanded={showConflicts}
            onClick={() => setShowConflicts((v) => !v)}
            className="min-h-11 font-medium hover:underline md:min-h-8"
          >
            {t("copy_conflict_count").replace("{count}", String(conflictCount))}
          </button>
          {showConflicts && (
            <ul className="space-y-0.5 pb-2">
              {conflicts.slice(0, 20).map((c) => (
                <li key={c.date}>
                  {dayMonth(c.date)}: {c.conflict}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
