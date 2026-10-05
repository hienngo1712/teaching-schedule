"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { GUIDE_DOCX_FILENAME, GUIDE_DOCX_PATH } from "@/lib/guide-content"
import { RELEASES } from "@/lib/releases"

export function DocxDownloadButton({ doc }: { doc: "guide" | "updates" }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      // Chỉ tải thư viện docx khi bấm, trang mở nhanh như cũ.
      // file-saver là CJS: import() qua webpack chỉ có default (chính là hàm saveAs), không có tên saveAs.
      const [lib, { default: saveAs }] = await Promise.all([import("@/lib/guide-docx"), import("file-saver")])
      saveAs(await lib.buildUpdatesDocx(RELEASES), lib.UPDATES_DOCX_FILENAME)
    } catch {
      toast.error(t("guide_download_failed"))
    } finally {
      setBusy(false)
    }
  }

  if (doc === "guide") {
    return (
      <Button asChild variant="outline" className="h-11 gap-2 md:h-10 print:hidden">
        <a href={GUIDE_DOCX_PATH} download={GUIDE_DOCX_FILENAME}>
          <FileDown className="size-4" aria-hidden />
          {t("guide_download_docx")}
        </a>
      </Button>
    )
  }

  return (
    <Button variant="outline" className="h-11 gap-2 md:h-10 print:hidden" onClick={download} disabled={busy}>
      <FileDown className="size-4" aria-hidden />
      {t("guide_download_docx")}
    </Button>
  )
}
