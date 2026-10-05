"use client"

import { ArrowUpCircle, ExternalLink, Sparkles, Wrench, X, type LucideIcon } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { formatReleaseDate, type Release, type ReleaseKind } from "@/lib/releases"
import type vi from "@/language/vi.json"

// Ô gọn theo yêu cầu người dùng (2026-10-05): 3 mục, mô tả 2 dòng; đủ chi tiết xem ở /updates.
const MAX_ITEMS = 3

const KIND: Record<ReleaseKind, { icon: LucideIcon; label: keyof typeof vi; box: string; badge: string }> = {
  new: { icon: Sparkles, label: "whatsnew_kind_new", box: "bg-primary/10 text-primary", badge: "bg-primary/10 text-primary" },
  improve: { icon: ArrowUpCircle, label: "whatsnew_kind_improve", box: "bg-amber-50 text-amber-600", badge: "bg-amber-50 text-amber-700" },
  fix: { icon: Wrench, label: "whatsnew_kind_fix", box: "bg-slate-100 text-slate-600", badge: "bg-slate-100 text-slate-600" },
}

export function WhatsNewPanel({ release, onClose }: { release: Release; onClose: () => void }) {
  const { t } = useTranslation()
  const shown = release.items.slice(0, MAX_ITEMS)
  const rest = release.items.length - shown.length
  return (
    <div className="overflow-hidden rounded-xl bg-white">
      <div className="relative bg-gradient-to-br from-primary to-teal-900 px-4 py-3 pr-11 text-white">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold tracking-wide">{t("whatsnew_label")}</span>
          <span className="text-white/80">{formatReleaseDate(release.date)}</span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug">{release.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("whatsnew_close")}
          className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-white/90 hover:bg-white/15 md:size-8"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-3 px-4 py-3">
        {shown.map((item, i) => {
          const k = KIND[item.kind]
          const Icon = k.icon
          return (
            <li key={i} data-testid="whatsnew-item" className="flex gap-2.5">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${k.box}`}>
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {item.title}
                  <span className={`rounded px-1 py-px text-[9px] font-semibold ${k.badge}`}>{t(k.label)}</span>
                </p>
                <p className="line-clamp-2 text-xs text-slate-600">{item.body}</p>
              </div>
            </li>
          )
        })}
        {rest > 0 && <li className="text-xs text-slate-500">{t("whatsnew_more").replace("{n}", String(rest))}</li>}
      </ul>
      <div className="flex justify-end border-t px-4 py-2.5">
        <a
          href={`/updates#v${release.version}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 md:h-8"
        >
          {t("whatsnew_learn_more")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  )
}
