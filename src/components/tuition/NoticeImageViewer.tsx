"use client"

import { useMemo, useEffect } from "react"
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
  const url = useMemo(() => URL.createObjectURL(blob), [blob])

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [url])

  const hasShare = canShareFiles()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="fixed inset-0 z-50 flex h-full w-full max-w-none flex-col justify-between border-0 bg-black p-4 sm:rounded-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 items-center justify-center overflow-auto py-2">
          {/* Dùng <img> thật vì menu nhấn giữ của trình duyệt cho phép lưu thẳng vào thư viện Ảnh. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={title}
            className="max-h-[75vh] w-auto max-w-full object-contain"
          />
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
