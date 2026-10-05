"use client"

import { Database, ExternalLink, Lock, ShieldCheck, Trash2, UserRound, type LucideIcon } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PRIVACY_CONTACT } from "@/lib/privacy"
import type vi from "@/language/vi.json"

const POINTS: { icon: LucideIcon; lead: keyof typeof vi; body: keyof typeof vi }[] = [
  { icon: Database, lead: "privacy_summary_store_lead", body: "privacy_summary_store" },
  { icon: Lock, lead: "privacy_summary_protect_lead", body: "privacy_summary_protect" },
  { icon: UserRound, lead: "privacy_summary_who_lead", body: "privacy_summary_who" },
  { icon: Trash2, lead: "privacy_summary_delete_lead", body: "privacy_summary_delete" },
]

// Diễn giải lại 5 mục chính sách sẵn có, không thêm cam kết mới → không nâng CONSENT_TEXT_VERSION.
// Không dùng heading: /privacy phải giữ đúng 5 h2 (e2e consent-privacy).
export function PrivacySummary({ showFullLink = false }: { showFullLink?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-slate-700">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
        {/* Trang đăng ký có link Đọc đầy đủ; /privacy cho cả người đã có tài khoản nên không ghi "Trước khi đăng ký". */}
        {t(showFullLink ? "privacy_summary_title" : "privacy_summary_title_page")}
      </p>
      <ul className="space-y-2">
        {POINTS.map(({ icon: Icon, lead, body }) => (
          <li key={lead} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <strong className="font-semibold text-slate-900">{t(lead)}</strong>{" "}
              {t(body).replace("{contact}", PRIVACY_CONTACT)}
            </span>
          </li>
        ))}
      </ul>
      {showFullLink && (
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline underline-offset-2"
        >
          {t("privacy_read_full")}
          <ExternalLink className="size-4" aria-hidden />
          <span className="sr-only">{t("opens_new_tab")}</span>
        </a>
      )}
    </div>
  )
}
