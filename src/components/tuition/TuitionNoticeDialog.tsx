"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { saveAs } from "file-saver"
import { Download, Loader2, Share2 } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { removeVietnameseTones } from "@/lib/utils"
import { canShareFiles, elementToPngBlob, shareOrDownloadPng } from "@/lib/share-image"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TuitionNoticeCard } from "./TuitionNoticeCard"

type Props = { studentId: number; year: number; month: number; onClose: () => void }

// Chỉ mount khi mở → Blob và trạng thái tự reset mỗi lần mở.
export function TuitionNoticeDialog({ studentId, year, month, onClose }: Props) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const query = trpc.tuition.getNotice.useQuery({ studentId, year, month })
  const cardRef = useRef<HTMLDivElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [captureFailed, setCaptureFailed] = useState(false)
  const [shareable] = useState(canShareFiles)

  // Tạo sẵn ảnh ngay khi phiếu vẽ xong: Safari chặn navigator.share nếu gọi sau tác vụ bất đồng bộ (spec C S11).
  // Không phụ thuộc `t` (tạo mới mỗi render) để card không gọi lại onReady liên tục.
  const handleReady = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    setBlob(null)
    setCaptureFailed(false)
    elementToPngBlob(el)
      .then((b) => {
        // Card có thể đã mount lại (đổi Sheet ↔ Dialog) → bỏ kết quả của bản cũ.
        if (cardRef.current === el) setBlob(b)
      })
      .catch(() => {
        if (cardRef.current === el) setCaptureFailed(true)
      })
  }, [])

  // QRCode.toDataURL lỗi → card không bao giờ gọi onReady → không để nút kẹt loading mãi.
  const handleCardError = useCallback(() => {
    setBlob(null)
    setCaptureFailed(true)
  }, [])

  const notice = query.data
  const title = `${t("tuition_notice_title")} ${month}/${year}`
  const filename = notice
    ? `phieu-bao-hoc-phi-T${month}-${year}-${removeVietnameseTones(notice.fullName)}.png`
    : ""

  const body = (
    <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
      {query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-600">{t("load_error")}</p>
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !notice ? (
        <Skeleton className="mx-auto h-[560px] w-[360px] max-w-full rounded-lg" />
      ) : (
        <div className="space-y-4">
          {!notice.bankConfigured && notice.remaining > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>{t("notice_no_bank")}</p>
              <Link href="/settings" className="mt-1 inline-block font-medium underline">
                {t("open_settings")}
              </Link>
            </div>
          )}
          {/* Phiếu rộng cố định 360px; màn hẹp hơn thì cuộn ngang trong khung, không tràn trang. */}
          <div className="overflow-x-auto">
            <div className="mx-auto w-fit">
              {/* key = dataUpdatedAt → mount lại khi refetch đổi dữ liệu (kể cả khi payload QR vẫn null), chụp lại ảnh đúng dữ liệu mới. */}
              <TuitionNoticeCard
                key={query.dataUpdatedAt}
                ref={cardRef}
                notice={notice}
                onReady={handleReady}
                onError={handleCardError}
              />
            </div>
          </div>
          {captureFailed && <p className="text-center text-sm text-red-600">{t("load_error")}</p>}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="flex gap-2 border-t border-slate-200 p-4 md:justify-end">
      {shareable && (
        <Button
          variant="outline"
          className="h-11 flex-1 md:h-10 md:flex-none"
          disabled={!blob}
          onClick={() => blob && shareOrDownloadPng(blob, filename, title)}
        >
          {blob ? (
            <Share2 className="mr-2 size-4" />
          ) : captureFailed ? (
            <Share2 className="mr-2 size-4 opacity-50" />
          ) : (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {t("share")}
        </Button>
      )}
      <Button
        className="h-11 flex-1 md:h-10 md:flex-none"
        disabled={!blob}
        onClick={() => blob && saveAs(blob, filename)}
      >
        {blob ? (
          <Download className="mr-2 size-4" />
        ) : captureFailed ? (
          <Download className="mr-2 size-4 opacity-50" />
        ) : (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        {t("download_image")}
      </Button>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          data-testid="tuition-notice"
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]"
        >
          <DialogHeader className="border-b border-slate-200 p-4">
            <DialogTitle>{t("tuition_notice")}</DialogTitle>
          </DialogHeader>
          {body}
          {footer}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        data-testid="tuition-notice"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[450px]"
      >
        <SheetHeader className="border-b border-slate-200 p-4">
          <SheetTitle>{t("tuition_notice")}</SheetTitle>
        </SheetHeader>
        {body}
        {footer}
      </SheetContent>
    </Sheet>
  )
}
