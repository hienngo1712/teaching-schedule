"use client"

import { Phone, MessageCircle, ExternalLink } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"

const btn = "inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-foreground hover:bg-slate-50 md:h-10"
// 0979479550 → 0979 479 550 cho dễ đọc khi tel:/Zalo không mở được.
const pretty = (p: string) => p.replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3")

export function ContactOwner({ title }: { title?: string }) {
  const { t } = useTranslation()
  const { data } = trpc.contact.get.useQuery(undefined, { staleTime: 5 * 60_000 })
  if (!data) return null
  return (
    <div data-testid="contact-owner" className="space-y-2">
      <p className="text-sm text-slate-600">
        {title ?? t("contact_owner_title")} <span className="font-medium text-foreground">{pretty(data.phone)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${data.phone}`} className={btn}><Phone aria-hidden className="size-4" />{t("contact_call")}</a>
        <a href={`https://zalo.me/${data.phone}`} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle aria-hidden className="size-4" />Zalo</a>
        {data.facebookUrl && (
          <a href={data.facebookUrl} target="_blank" rel="noopener noreferrer" className={btn}><ExternalLink aria-hidden className="size-4" />Facebook</a>
        )}
      </div>
    </div>
  )
}
