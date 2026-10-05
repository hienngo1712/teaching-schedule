"use client"

import Link from "next/link"
import { Fragment } from "react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { DocxDownloadButton } from "@/components/common/DocxDownloadButton"
import { GUIDE_SECTIONS, stepShot, stepText } from "@/lib/guide-content"
import { GuideShot } from "@/components/guide/GuideShot"

// "**Nút**" → <strong>; nội dung tĩnh trong code nên không cần thư viện markdown.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-900">{part}</strong> : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  )
}

export function GuideContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-slate-700 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t("guide_title")}</h1>
        <DocxDownloadButton doc="guide" />
      </div>

      <nav aria-label={t("guide_toc")} className="rounded-lg border bg-slate-50 p-4 print:hidden">
        <p className="mb-2 font-semibold text-slate-900">{t("guide_toc")}</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {GUIDE_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-11 items-center text-primary hover:underline md:min-h-8">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3 break-inside-avoid">
          <h2 className="text-lg font-semibold text-slate-900">{i + 1}. {s.title}</h2>
          {s.intro && <p className="leading-relaxed"><Rich text={s.intro} /></p>}
          <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
            {s.steps.map((step, j) => {
              const shot = stepShot(step)
              return (
                <li key={j} className="break-inside-avoid">
                  <Rich text={stepText(step)} />
                  {shot && <GuideShot shot={shot} alt={stepText(step).replaceAll("**", "")} />}
                </li>
              )
            })}
          </ol>
          {s.tips && (
            <ul className="space-y-1 rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm">
              {s.tips.map((tip, j) => <li key={j}><Rich text={tip} /></li>)}
            </ul>
          )}
        </section>
      ))}

      <div className="flex flex-wrap gap-4 border-t pt-4 print:hidden">
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-sm text-primary underline">{t("privacy_title")}</Link>
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-primary underline">{t("guide_back_login")}</Link>
      </div>
    </main>
  )
}
