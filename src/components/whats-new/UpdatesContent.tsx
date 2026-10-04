"use client"

import Link from "next/link"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PrintButton } from "@/components/common/PrintButton"
import { RELEASES, formatReleaseDate } from "@/lib/releases"
import type vi from "@/language/vi.json"

const KIND_LABEL: Record<"new" | "improve" | "fix", keyof typeof vi> = {
  new: "whatsnew_kind_new",
  improve: "whatsnew_kind_improve",
  fix: "whatsnew_kind_fix",
}

export function UpdatesContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-slate-700 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t("updates_title")}</h1>
        <PrintButton label={t("print_pdf")} />
      </div>
      {RELEASES.map((r) => (
        <section key={r.version} id={`v${r.version}`} className="scroll-mt-4 space-y-3 border-t pt-6 break-inside-avoid">
          <p className="text-sm text-slate-500">v{r.version} · {formatReleaseDate(r.date)}</p>
          <h2 className="text-lg font-semibold text-slate-900">{r.title}</h2>
          <p>{r.summary}</p>
          <ul className="space-y-3">
            {r.items.map((item, i) => (
              <li key={i} className="break-inside-avoid">
                <p className="font-semibold text-slate-900">
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{t(KIND_LABEL[item.kind])}</span>
                  {item.title}
                </p>
                <p className="text-sm">{item.body}</p>
                {item.guideId && (
                  <a href={`/guide#${item.guideId}`} className="inline-flex min-h-11 items-center text-sm text-primary underline print:hidden md:min-h-8">
                    {t("updates_guide_link")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href="/guide" className="inline-flex min-h-11 items-center text-sm text-primary underline print:hidden">{t("guide_title")}</Link>
    </main>
  )
}
