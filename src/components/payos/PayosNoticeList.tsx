"use client"

import { useTranslation } from "@/components/providers/LanguageProvider"
import { cn, formatCurrency } from "@/lib/utils"
import dayjs from "@/lib/dayjs"
import type { RouterOutputs } from "@/lib/trpc"

type Item = RouterOutputs["payosNotice"]["list"]["items"][number]

const LIMIT = 20

export function PayosNoticeList({ items, onPick }: { items: Item[]; onPick: (i: Item) => void }) {
  const { t } = useTranslation()
  if (items.length === 0) return <p className="px-4 py-6 text-sm text-slate-600">{t("payos_notice_empty")}</p>

  return (
    <div>
      <ul className="divide-y">
        {items.map((i) => {
          const place = i.kind === "place"
          const [a, rest = ""] = t(place ? "payos_notice_place_line" : "payos_notice_line").replace("{month}", String(i.month)).split("{name}")
          const [b, c = ""] = rest.split("{amount}")
          const paid = dayjs(i.paidAt).tz("Asia/Ho_Chi_Minh")
          const deleted = place ? i.placeDeleted : i.studentDeleted
          const body = (
            <>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.unread ? "bg-primary" : "bg-transparent")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-800">
                  {a}<strong>{place ? i.placeName : i.studentName}</strong>{b}<strong>{formatCurrency(i.amount)}</strong>{c}
                </span>
                <span className="block text-xs text-slate-500">
                  {t(place ? "payos_notice_place_meta" : "payos_notice_meta").replace("{time}", paid.format("HH:mm")).replace("{d}", paid.format("D/M")).replace("{month}", String(i.month))}
                </span>
              </span>
            </>
          )
          const cls = cn("flex min-h-11 w-full items-start gap-2 px-4 py-2.5 text-left", i.unread && "bg-primary/5")
          return (
            <li key={`${i.kind ?? "student"}-${i.id}`}>
              {deleted ? (
                <div className={cn(cls, "text-slate-500")}>{body}</div>
              ) : (
                <button type="button" className={cn(cls, "hover:bg-slate-50")} onClick={() => onPick(i)}>
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {items.length >= LIMIT && <p className="border-t px-4 py-2 text-xs text-slate-500">{t("payos_notice_limit")}</p>}
    </div>
  )
}
