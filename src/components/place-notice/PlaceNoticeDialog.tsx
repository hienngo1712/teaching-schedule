"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { saveAs } from "file-saver"
import { Check, Download, ImageDown, Link2, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { removeVietnameseTones } from "@/lib/utils"
import { canShareFiles, elementToPngBlob, shareOrDownloadPng } from "@/lib/share-image"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { NoticeImageViewer } from "@/components/tuition/NoticeImageViewer"
import { PlaceNoticeCard } from "./PlaceNoticeCard"

type Props = { placeId: number; year: number; month: number; onClose: () => void }

// Phiếu báo theo nơi dạy (spec AN §1, mẫu 12), theo TuitionNoticeDialog: Sao chép link / Tải ảnh / Đánh dấu đã gửi.
// Sao chép link hoặc tải/chia sẻ ảnh thì tự đánh dấu đã gửi (như spec V), có Hoàn tác.
export function PlaceNoticeDialog({ placeId, year, month, onClose }: Props) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const query = trpc.placeNotice.get.useQuery({ placeId, year, month })
  const linkMutation = trpc.placeNotice.link.useMutation()
  const markMutation = trpc.placeNotice.markSent.useMutation({
    onSuccess: (_res, vars) => {
      void utils.placeNotice.get.invalidate()
      void utils.income.month.invalidate()
      if (!vars.sent) return
      toast(t("notice_marked"), {
        action: {
          label: t("undo"),
          onClick: () => {
            void utils.client.placeNotice.markSent
              .mutate({ ...vars, sent: false })
              .then(() => Promise.all([utils.placeNotice.get.invalidate(), utils.income.month.invalidate()]))
          },
        },
      })
    },
    onError: () => toast.error(t("generic_error")),
  })
  const cardRef = useRef<HTMLDivElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [captureFailed, setCaptureFailed] = useState(false)
  const [shareable] = useState(canShareFiles)
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null)

  const mark = (sent: boolean) => markMutation.mutate({ placeId, year, month, sent })

  // Tạo sẵn ảnh khi phiếu vẽ xong: Safari chặn navigator.share nếu gọi sau tác vụ bất đồng bộ.
  const handleReady = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    setBlob(null)
    setCaptureFailed(false)
    elementToPngBlob(el)
      .then((b) => {
        if (cardRef.current === el) setBlob(b)
      })
      .catch(() => {
        if (cardRef.current === el) setCaptureFailed(true)
      })
  }, [])

  const copyLink = async () => {
    try {
      const { path } = await linkMutation.mutateAsync({ placeId })
      const url = `${window.location.origin}${path}?thang=${year}-${String(month).padStart(2, "0")}`
      await navigator.clipboard.writeText(url)
      toast.success(t("place_notice_link_copied"))
      mark(true)
    } catch {
      toast.error(t("generic_error"))
    }
  }

  const notice = query.data
  const title = `${t("place_notice_title")} ${month}/${year}`
  const filename = notice ? `phieu-bao-day-kem-T${month}-${year}-${removeVietnameseTones(notice.placeName)}.png` : ""
  const imgIcon = (Icon: typeof Download) =>
    blob ? <Icon className="mr-2 size-4" /> : captureFailed ? <Icon className="mr-2 size-4 opacity-50" /> : <Loader2 className="mr-2 size-4 animate-spin" />

  const body = (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
      {query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-600">{t("load_error")}</p>
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !notice ? (
        <Skeleton className="mx-auto h-[560px] w-full max-w-[360px] rounded-lg" />
      ) : (
        <div className="space-y-3">
          {notice.sentAt && (
            <p
              data-testid="place-notice-sent"
              className={notice.amountChanged ? "rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800" : "text-center text-xs text-slate-500"}
            >
              {notice.amountChanged
                ? t("place_notice_changed")
                : t("place_notice_sent_at").replace("{d}", new Date(notice.sentAt).toLocaleDateString("vi-VN"))}
            </p>
          )}
          {/* key = dataUpdatedAt → mount lại khi refetch đổi dữ liệu, chụp lại ảnh đúng dữ liệu mới. */}
          <PlaceNoticeCard
            key={query.dataUpdatedAt}
            ref={cardRef}
            notice={notice}
            onReady={handleReady}
            noBankAction={
              <Link href="/settings" className="inline-block font-medium text-primary underline">
                {t("place_notice_add_bank")}
              </Link>
            }
          />
          {captureFailed && <p className="text-center text-sm text-red-600">{t("load_error")}</p>}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4 md:flex md:justify-end">
      <Button variant="outline" className="h-11 md:h-10" disabled={!notice || linkMutation.isPending} onClick={copyLink}>
        {linkMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
        {t("place_notice_copy_link")}
      </Button>
      {shareable && (
        <Button
          variant="outline"
          className="h-11 md:h-10"
          disabled={!blob}
          onClick={async () => {
            if (!blob) return
            const result = await shareOrDownloadPng(blob, filename, title)
            if (result === "shared" || result === "downloaded") mark(true)
          }}
        >
          {imgIcon(Share2)}
          {t("share")}
        </Button>
      )}
      <Button
        className="h-11 md:h-10"
        disabled={!blob}
        onClick={() => {
          if (!blob) return
          if (isDesktop) saveAs(blob, filename)
          else setViewerBlob(blob)
          mark(true)
        }}
      >
        {imgIcon(isDesktop ? Download : ImageDown)}
        {t(isDesktop ? "download_image" : "save_image")}
      </Button>
      <Button
        variant="ghost"
        className="h-11 md:h-10"
        disabled={!notice || markMutation.isPending}
        onClick={() => mark(!notice?.sentAt)}
      >
        <Check className="mr-2 size-4" />
        {t(notice?.sentAt ? "place_notice_unmark" : "place_notice_mark_sent")}
      </Button>
    </div>
  )

  return (
    <>
      {isDesktop ? (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent data-testid="place-notice" className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
            <DialogHeader className="border-b border-slate-200 p-4">
              <DialogTitle>{t("place_notice")}</DialogTitle>
            </DialogHeader>
            {body}
            {footer}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
          <SheetContent data-testid="place-notice" className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[450px]">
            <SheetHeader className="border-b border-slate-200 p-4">
              <SheetTitle>{t("place_notice")}</SheetTitle>
            </SheetHeader>
            {body}
            {footer}
          </SheetContent>
        </Sheet>
      )}
      {viewerBlob && <NoticeImageViewer blob={viewerBlob} filename={filename} title={title} onClose={() => setViewerBlob(null)} />}
    </>
  )
}
