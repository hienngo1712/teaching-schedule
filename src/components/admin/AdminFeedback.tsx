"use client"

import { Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { dateOrDash } from "./admin-format"

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
      ))}
    </span>
  )
}

export function AdminFeedback() {
  const { t } = useTranslation()
  const query = trpc.admin.feedbackList.useInfiniteQuery({}, { getNextPageParam: (last) => last.nextCursor ?? undefined })
  const first = query.data?.pages[0]
  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const star = (n: number) => t("feedback_star").replace("{n}", String(n))

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_feedback")} />
      {query.isPending ? (
        <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
      ) : query.isError || !first ? (
        <div className="text-center text-sm text-slate-600">
          {t("load_error")}{" "}
          <Button variant="link" onClick={() => query.refetch()}>{t("retry")}</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[auto_1fr] sm:gap-6">
            <div>
              <p className="text-sm text-slate-500">{t("admin_feedback_avg")}</p>
              <p data-testid="feedback-average" className="text-3xl font-semibold text-slate-900">
                {first.average === null ? "-" : first.average.toLocaleString("vi-VN")}
              </p>
              <p className="text-sm text-slate-500">{t("admin_feedback_total").replace("{n}", String(first.total))}</p>
            </div>
            <ul className="space-y-1">
              {([5, 4, 3, 2, 1] as const).map((n) => {
                const c = first.counts[n]
                return (
                  <li key={n} data-testid={`feedback-count-${n}`} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-slate-600">{star(n)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                      <span className="block h-full bg-amber-400" style={{ width: `${first.total ? (c / first.total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-slate-700">{c}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          {items.length === 0 ? (
            <p className="text-center text-sm text-slate-500">{t("admin_feedback_empty")}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((f) => (
                <li key={f.id} data-testid="feedback-item" className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={f.rating} label={star(f.rating)} />
                    <span className="text-xs text-slate-500">{dateOrDash(f.createdAt)}</span>
                  </div>
                  <p className={cn("mt-2 whitespace-pre-line text-sm", f.message ? "text-slate-900" : "italic text-slate-400")}>
                    {f.message ?? t("admin_feedback_no_message")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{f.username}</span>
                    {f.fullName ? ` (${f.fullName})` : ""} · {f.page} · v{f.appVersion}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {query.hasNextPage && (
            <div className="text-center">
              <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="h-11 md:h-10">
                {query.isFetchingNextPage && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("admin_feedback_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
