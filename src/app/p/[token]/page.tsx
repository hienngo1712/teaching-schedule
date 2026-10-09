import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { db } from "@/server/db"
import { getParentView } from "@/server/services/parent-link.service"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ParentView } from "@/components/parent/ParentView"

// Không cache: token sai/đã tắt phải 404 ngay, và Next tự trả Cache-Control private, no-store.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Thông tin học tập",
  robots: { index: false, follow: false },
}

export default async function ParentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ thang?: string | string[] }>
}) {
  const { token } = await params
  const { thang } = await searchParams
  // Origin cho returnUrl của link payOS trên phiếu (spec AH §5).
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const origin = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : null
  // ?thang=a&thang=b cho ra mảng → coi như không chọn tháng.
  const view = await getParentView(db, token, typeof thang === "string" ? thang : undefined, origin)
  if (!view) notFound()

  return (
    <LanguageProvider forcedLanguage="vi">
      <ParentView view={view} />
    </LanguageProvider>
  )
}
