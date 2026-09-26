import { useRef, useState } from "react"
import { saveAs } from "file-saver"
import { toast } from "sonner"
import { useTranslation } from "@/components/providers/LanguageProvider"

const FALLBACK_NAME = "SaoLuu.xlsx"

export function filenameFromDisposition(header: string | null): string {
  return header?.match(/filename="([^"]+)"/)?.[1] ?? FALLBACK_NAME
}

async function fetchBackup(): Promise<void> {
  const res = await fetch("/api/backup")
  // Phiên hết hạn thì middleware chuyển về /login → fetch nhận HTML 200, phải chặn.
  if (!res.ok || !res.headers.get("Content-Type")?.includes("spreadsheetml")) {
    throw new Error(`Sao lưu thất bại (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  saveAs(blob, filenameFromDisposition(res.headers.get("Content-Disposition")))
}

export function useBackupDownload() {
  const { t } = useTranslation()
  const [isDownloading, setIsDownloading] = useState(false)
  // State chỉ đổi sau lần render kế tiếp; ref chặn ngay lần bấm thứ 2.
  const busy = useRef(false)

  function download() {
    if (busy.current) return
    busy.current = true
    setIsDownloading(true)
    const task = fetchBackup().finally(() => {
      busy.current = false
      setIsDownloading(false)
    })
    toast.promise(task, {
      loading: t("backup_preparing"),
      success: t("backup_done"),
      error: t("backup_error"),
    })
  }

  return { download, isDownloading }
}
