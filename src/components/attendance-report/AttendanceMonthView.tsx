"use client"

import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { RouterOutputs } from "@/lib/trpc"
import { cn } from "@/lib/utils"

type Data = RouterOutputs["attendanceReport"]["month"]
type Row = Data["students"][number]
type Query = { data?: Data; isPending: boolean; isError: boolean; refetch: () => unknown }

export const rateText = (rate: number | null) => (rate === null ? "–" : `${String(rate).replace(".", ",")}%`)

// ≥ 90% xanh, ≥ 70% màu nhấn, dưới 70% đỏ nợ (dùng chung cho dải năm học).
export function rateTone(rate: number | null): string {
  if (rate === null) return "bg-slate-100"
  if (rate >= 90) return "bg-success"
  if (rate >= 70) return "bg-primary/60"
  return "bg-debt"
}

function RateBar({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded bg-slate-100" aria-hidden>
        <div className={cn("h-full", rateTone(rate))} style={{ width: `${rate ?? 0}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-medium tabular-nums text-slate-700">{rateText(rate)}</span>
    </div>
  )
}

// Bảng chuyên cần tháng (mẫu 09a): mỗi HS buổi có mặt / tổng, thanh tỉ lệ, vắng, muộn.
export function AttendanceMonthView({ query }: { query: Query }) {
  const { t } = useTranslation()
  const name = (s: Row) => (
    <span className="font-medium text-slate-900">
      {s.fullName}
      {s.isDeleted && <span className="ml-1 text-xs font-normal text-slate-400">({t("att_deleted")})</span>}
    </span>
  )
  const columns: Column<Row>[] = [
    { header: t("stt"), cell: (_, i) => i + 1, className: "w-[60px] text-center text-slate-400" },
    { header: t("student"), cell: name },
    { header: t("grade"), cell: (s) => s.grade, className: "w-16 text-center" },
    { header: t("att_col_ratio"), cell: (s) => `${s.present}/${s.recorded}`, className: "w-28 text-center tabular-nums" },
    { header: t("att_col_rate"), cell: (s) => <RateBar rate={s.rate} />, className: "w-48" },
    { header: t("att_absent"), cell: (s) => s.absent, className: "w-16 text-center tabular-nums text-debt" },
    { header: t("att_late"), cell: (s) => s.late, className: "w-16 text-center tabular-nums" },
  ]
  return (
    <ResponsiveList
      items={query.data?.students ?? []}
      getKey={(s) => s.studentId}
      columns={columns}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => query.refetch()}
      errorText={t("load_error")}
      retryText={t("retry")}
      emptyText={t("att_empty")}
      renderCard={(s) => (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate">{name(s)}</p>
              <p className="text-xs text-slate-500">
                {t("grade")} {s.grade}
              </p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-slate-700">{`${s.present}/${s.recorded}`}</span>
          </div>
          <div className="mt-3">
            <RateBar rate={s.rate} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t("att_absent")} {s.absent} · {t("att_late")} {s.late}
          </p>
        </div>
      )}
    />
  )
}
