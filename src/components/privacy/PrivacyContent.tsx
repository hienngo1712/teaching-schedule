"use client"

import Link from "next/link"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { CONSENT_TEXT_VERSION } from "@/lib/consent"
import { PRIVACY_CONTACT } from "@/lib/privacy"

const SECTIONS = [
  ["privacy_collect_title", "privacy_collect_body"],
  ["privacy_purpose_title", "privacy_purpose_body"],
  ["privacy_protect_title", "privacy_protect_body"],
  ["privacy_teacher_title", "privacy_teacher_body"],
  ["privacy_delete_title", "privacy_delete_body"],
] as const

export function PrivacyContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-slate-700">
      <h1 className="text-2xl font-semibold text-slate-900">{t("privacy_title")}</h1>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{t(title)}</h2>
          <p className="leading-relaxed">{t(body).replace("{contact}", PRIVACY_CONTACT)}</p>
        </section>
      ))}
      <p className="text-sm text-slate-500">{t("privacy_version").replace("{v}", CONSENT_TEXT_VERSION)}</p>
      <Link href="/login" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2">
        {t("login")}
      </Link>
    </main>
  )
}
