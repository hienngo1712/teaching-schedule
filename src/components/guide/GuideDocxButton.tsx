"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { GUIDE_SECTIONS } from "@/lib/guide-content"

export function GuideDocxButton() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      // Chỉ tải thư viện docx khi bấm, trang hướng dẫn mở nhanh như cũ.
      const [{ buildGuideDocx, GUIDE_DOCX_FILENAME }, { saveAs }] = await Promise.all([
        import("@/lib/guide-docx"),
        import("file-saver"),
      ])
      saveAs(await buildGuideDocx(GUIDE_SECTIONS, process.env.NEXT_PUBLIC_APP_VERSION ?? ""), GUIDE_DOCX_FILENAME)
    } catch {
      toast.error(t("guide_download_failed"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" className="h-11 gap-2 md:h-10 print:hidden" onClick={download} disabled={busy}>
      <FileDown className="size-4" aria-hidden />
      {t("guide_download_docx")}
    </Button>
  )
}
