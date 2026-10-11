import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/server/db"
import { getPublicPlaceNotice } from "@/server/services/place-notice.service"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PayerView } from "@/components/place-notice/PayerView"

// Không cache: token sai/đã tắt/tạo mới phải 404 ngay (spec AN §2).
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Phiếu báo dạy kèm",
  robots: { index: false, follow: false },
}

export default async function PayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ thang?: string | string[] }>
}) {
  const { token } = await params
  const { thang } = await searchParams
  // ?thang=a&thang=b cho ra mảng → coi như không chọn tháng.
  const view = await getPublicPlaceNotice(db, token, typeof thang === "string" ? thang : undefined)
  if (!view) notFound()

  return (
    <LanguageProvider forcedLanguage="vi">
      <PayerView view={view} />
    </LanguageProvider>
  )
}
