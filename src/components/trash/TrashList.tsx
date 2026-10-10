"use client"

import { useEffect, useState } from "react"
import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { TRASH_TYPES, type TrashType } from "@/lib/schemas/trash"
import type { TrashItemDTO } from "@/lib/types/models"
import { formatCurrency, formatDate, formatDayOfWeek, cn } from "@/lib/utils"
import { PurgeDialog } from "./PurgeDialog"

const TYPE_KEY = { session: "trash_type_session", student: "students", payment: "trash_type_payment", subject: "subject" } as const

// deletedAt là thời điểm UTC; cộng 7h rồi đọc getUTC* để ra giờ VN bất kể múi giờ máy.
function vnDateTime(d: Date | string): string {
  const v = new Date(new Date(d).getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${formatDate(v)} ${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`
}

export function TrashList() {
  const { t } = useTranslation()
  const [type, setType] = useState<TrashType>("session")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [purgeTarget, setPurgeTarget] = useState<TrashType | "all" | null>(null)
  const utils = trpc.useUtils()
  const counts = trpc.trash.counts.useQuery()
  const list = trpc.trash.list.useQuery({ type, page, limit: pageSize })

  const afterPurge = (r: { purged: Record<TrashType, number> }) => {
    const n = Object.values(r.purged).reduce((a, b) => a + b, 0)
    toast.success(t("purge_success").replace("{n}", String(n)))
    setPurgeTarget(null)
    setPage(1)
    utils.trash.counts.invalidate()
    utils.trash.list.invalidate()
  }
  const purge = trpc.trash.purge.useMutation({ onSuccess: afterPurge, onError: (e) => toast.error(e.message) })
  const purgeAll = trpc.trash.purgeAll.useMutation({ onSuccess: afterPurge, onError: (e) => toast.error(e.message) })
  const total = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : 0
  const tabCount = counts.data?.[type] ?? 0

  const totalPages = list.data?.totalPages ?? 0
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const restore = trpc.trash.restore.useMutation({
    onSuccess: () => {
      toast.success(t("restored"))
      utils.trash.counts.invalidate()
      utils.trash.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const main = (it: TrashItemDTO): string => {
    switch (it.type) {
      case "session":
        return `${formatDayOfWeek(it.sessionDate)} ${formatDate(it.sessionDate)} · ${it.startTime}–${it.endTime} · ${it.subjectName}`
      case "student":
        return `${it.fullName} · ${t("grade")} ${it.grade}`
      case "payment":
        return `${formatCurrency(it.amount)} · ${it.studentName}`
      case "subject":
        return it.name
    }
  }
  const sub = (it: TrashItemDTO): string | null => {
    if (it.type === "session") return [it.isMakeup ? t("makeup_session") : null, it.title].filter(Boolean).join(" · ") || null
    if (it.type === "payment") {
      return t("paid_on_month")
        .replace("{date}", formatDate(it.paidAt))
        .replace("{month}", String(it.month))
        .replace("{year}", String(it.year))
    }
    return null
  }
  const restoreButton = (it: TrashItemDTO) => (
    <Button
      type="button"
      variant="outline"
      className="h-11 md:h-9"
      disabled={restore.isPending}
      onClick={() => restore.mutate({ type: it.type, id: it.id })}
    >
      <RotateCcw className="mr-2 size-4" />
      {t("restore")}
    </Button>
  )
  const content = (it: TrashItemDTO) => (
    <div className="min-w-0">
      <p className="flex items-center gap-2 font-medium text-foreground">
        {it.type === "subject" && <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />}
        <span className="truncate">{main(it)}</span>
      </p>
      {sub(it) && <p className="truncate text-sm text-slate-500">{sub(it)}</p>}
    </div>
  )

  const columns: Column<TrashItemDTO>[] = [
    { header: t(TYPE_KEY[type]), cell: content },
    { header: t("deleted_at").replace("{time}", "").trim(), cell: (it) => vnDateTime(it.deletedAt), className: "w-44 whitespace-nowrap text-slate-600" },
    { header: <span className="sr-only">{t("actions")}</span>, cell: restoreButton, className: "w-36 text-right" },
  ]

  return (
    <div className="space-y-4 pb-14">
      <PageHeader title={t("trash")} description={t("trash_hint")} />
      {/* AK: điện thoại 4 tab 1 hàng cuộn ngang; 2 nút dọn gom vào ⋯ cạnh tab. */}
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label={t("trash")} className="flex min-w-0 flex-1 gap-2 overflow-x-auto md:flex-wrap">
          {TRASH_TYPES.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={type === k}
              onClick={() => { setType(k); setPage(1) }}
              className={cn(
                "min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium md:min-h-9",
                type === k ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {t(TYPE_KEY[k])} {counts.data?.[k] ?? 0}
            </button>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 md:size-9" aria-label={t("more_actions")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="min-h-11 text-red-600 focus:text-red-700 md:min-h-9"
              disabled={tabCount === 0}
              onSelect={() => setPurgeTarget(type)}
            >
              {t("purge_tab").replace("{n}", String(tabCount))}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11 gap-2 text-red-600 focus:text-red-700 md:min-h-9"
              disabled={total === 0}
              onSelect={() => setPurgeTarget("all")}
            >
              <Trash2 className="size-4" />
              {t("purge_all")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ResponsiveList
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => list.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={list.data?.items ?? []}
        getKey={(it) => `${it.type}-${it.id}`}
        columns={columns}
        emptyText={t("trash_empty")}
        renderCard={(it) => (
          <div data-testid="trash-card" className="flex items-start justify-between gap-3 rounded-lg border bg-white p-4">
            <div className="min-w-0 space-y-1">
              {content(it)}
              <p className="text-xs text-slate-500">{t("deleted_at").replace("{time}", vnDateTime(it.deletedAt))}</p>
            </div>
            {restoreButton(it)}
          </div>
        )}
      />
      {(list.data?.totalCount ?? 0) > 20 && (
        <DataTablePagination
          currentPage={page}
          totalPages={list.data?.totalPages ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          totalItems={list.data?.totalCount ?? 0}
        />
      )}
      <PurgeDialog
        open={purgeTarget !== null}
        count={purgeTarget === "all" ? total : tabCount}
        typeLabel={purgeTarget === "all" || purgeTarget === null ? null : t(TYPE_KEY[purgeTarget])}
        isStudent={purgeTarget === "all" ? (counts.data?.student ?? 0) > 0 : purgeTarget === "student"}
        pending={purge.isPending || purgeAll.isPending}
        onConfirm={() => (purgeTarget === "all" ? purgeAll.mutate() : purgeTarget && purge.mutate({ type: purgeTarget }))}
        onOpenChange={(o) => !o && setPurgeTarget(null)}
      />
    </div>
  )
}
