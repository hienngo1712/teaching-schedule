"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { canShareFiles, shareOrDownloadPng } from "@/lib/share-image"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  blob: Blob
  filename: string
  title: string
  onClose: () => void
}

export function NoticeImageViewer({ blob, filename, title, onClose }: Props) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string>()

  // Tạo và thu hồi trong cùng effect: StrictMode (dev) chạy effect 2 lần, useMemo sẽ giữ URL đã thu hồi.
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const hasShare = canShareFiles()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* DialogContent gốc canh giữa bằng left/top 50% + translate -50%: phải tắt cả hai để phủ kín màn hình. */}
      <DialogContent className="left-0 top-0 z-50 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col justify-between border-0 bg-black p-4 sm:rounded-none [&>button]:text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 items-center justify-center overflow-auto py-2">
          {/* Dùng <img> thật vì menu nhấn giữ của trình duyệt cho phép lưu thẳng vào thư viện Ảnh. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img
            src={url}
            alt={title}
            className="max-h-[75vh] w-auto max-w-full object-contain"
          />}
        </div>

        <div className="flex flex-col gap-3 pb-2 pt-2">
          <p className="text-center text-sm text-white/80">{t("save_image_hint")}</p>
          {hasShare && (
            <Button
              variant="secondary"
              className="h-11 min-h-[44px] w-full"
              onClick={() => shareOrDownloadPng(blob, filename, title)}
            >
              {t("open_share_sheet")}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-11 min-h-[44px] w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={onClose}
          >
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
