"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { saveAs } from "file-saver"
import { Copy, Download, ImageDown, Link2, Loader2, Share2 } from "lucide-react"
import { trpc } from "@/lib/trpc"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { removeVietnameseTones } from "@/lib/utils"
import { toast } from "sonner"
import { canShareFiles, elementToPngBlob, shareOrDownloadPng } from "@/lib/share-image"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TuitionNoticeCard } from "./TuitionNoticeCard"
import { NoticeImageViewer } from "./NoticeImageViewer"
import { ParentLinkDialog } from "@/components/students/ParentLinkDialog"

type ExportKind = "share" | "download" | "view"
type Props = { studentId: number; year: number; month: number; onClose: () => void }

// Chỉ mount khi mở → Blob và trạng thái tự reset mỗi lần mở.
export function TuitionNoticeDialog({ studentId, year, month, onClose }: Props) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const query = trpc.tuition.getNotice.useQuery({ studentId, year, month })
  // Callback cấp hook vẫn chạy khi dialog đã đóng → không mất toast Hoàn tác.
  const setNoticeSentMutation = trpc.tuition.setNoticeSent.useMutation({
    onSuccess: (_res, vars) => {
      void utils.tuition.getMonthlyStatus.invalidate()
      if (!vars.sent) return
      toast(t("notice_marked"), {
        action: {
          label: t("undo"),
          onClick: () => {
            void utils.client.tuition.setNoticeSent
              .mutate({ ...vars, sent: false })
              .then(() => utils.tuition.getMonthlyStatus.invalidate())
          },
        },
      })
    },
    onError: () => toast.error(t("generic_error")),
  })
  // Nhận xét tháng (AT): null = chưa sửa, hiện bản đã lưu. Lưu xong TRPCProvider tự refetch phiếu → xem trước cập nhật.
  const [comment, setComment] = useState<string | null>(null)
  // Bản vừa gửi lưu: blur + bấm xuất cùng lúc không gửi 2 lần.
  const sentComment = useRef<string | null>(null)
  // Bấm xuất khi nhận xét chưa lưu: lưu trước, chờ ảnh chụp đúng nhận xét mới rồi mới xuất (LEADER điểm 5).
  const [pendingExport, setPendingExport] = useState<{ kind: ExportKind; text: string } | null>(null)
  const saveCommentMutation = trpc.tuition.saveParentComment.useMutation({
    onSuccess: () => toast.success(t("comment_saved")),
    onError: () => {
      sentComment.current = null
      setPendingExport(null)
      toast.error(t("generic_error"))
    },
  })
  // Chốt gói link PH như StudentList: khoá + chưa có link → mở nâng cấp.
  const linkGate = useFeatureGate("parentLink")
  const [linkOpen, setLinkOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  // Nhận xét có trên ảnh đang giữ: ảnh cũ (trước khi lưu) không được xuất thay ảnh mới.
  const [blobComment, setBlobComment] = useState("")
  const noticeRef = useRef<TuitionNoticeDTO | undefined>(undefined)
  const [captureFailed, setCaptureFailed] = useState(false)
  const [shareable] = useState(canShareFiles)
  // Giữ ảnh lúc mở: đánh dấu đã gửi → refetch → card chụp lại (blob về null) mà màn Lưu ảnh không được tắt/mở lại.
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null)

  const markNoticeSent = () => setNoticeSentMutation.mutate({ studentId, year, month, sent: true })

  // Tạo sẵn ảnh ngay khi phiếu vẽ xong: Safari chặn navigator.share nếu gọi sau tác vụ bất đồng bộ (spec C S11).
  // Không phụ thuộc `t` (tạo mới mỗi render) để card không gọi lại onReady liên tục.
  const handleReady = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    const forComment = noticeRef.current?.parentComment ?? ""
    setBlob(null)
    setCaptureFailed(false)
    elementToPngBlob(el)
      .then((b) => {
        // Card có thể đã mount lại (đổi Sheet ↔ Dialog) → bỏ kết quả của bản cũ.
        if (cardRef.current === el) {
          setBlob(b)
          setBlobComment(forComment)
        }
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
  noticeRef.current = notice
  const title = `${t("tuition_notice_title")} ${month}/${year}`
  const filename = notice
    ? `phieu-bao-hoc-phi-T${month}-${year}-${removeVietnameseTones(notice.fullName)}.png`
    : ""

  const savedComment = notice?.parentComment ?? ""
  const commentValue = comment ?? savedComment
  const commentDirty = commentValue.trim() !== savedComment

  // Bản server sẽ có: đang/vừa gửi thì là bản gửi đi, chưa gửi thì là bản đã lưu (QA-3).
  const needsSave = (text: string) => text !== (sentComment.current ?? savedComment)
  const saveComment = () => {
    const text = commentValue.trim()
    if (!needsSave(text)) return
    sentComment.current = text
    saveCommentMutation.mutate({ studentId, year, month, parentComment: text })
  }

  // Đóng hộp bằng Esc/nút X/bấm ngoài có thể không bắn blur → lưu nhận xét còn dở khi unmount (như TuitionDetailSheet, spec AR B2).
  const unmountSave = useRef<() => void>(() => {})
  unmountSave.current = () => {
    if (comment !== null) saveComment()
  }
  useEffect(() => () => unmountSave.current(), [])

  const exportImage = async (kind: ExportKind, b: Blob) => {
    if (kind === "download") saveAs(b, filename)
    else if (kind === "view") setViewerBlob(b)
    else {
      const result = await shareOrDownloadPng(b, filename, title)
      if (result !== "shared" && result !== "downloaded") return
    }
    markNoticeSent()
  }

  const startExport = (kind: ExportKind) => {
    if (!blob) return
    if (!commentDirty && blobComment === savedComment) return void exportImage(kind, blob)
    // Share sau tác vụ bất đồng bộ có thể bị Safari chặn → shareOrDownloadPng tự chuyển sang tải file.
    setPendingExport({ kind, text: commentValue.trim() })
    saveComment()
  }

  // Phiếu đã refetch có nhận xét vừa lưu và ảnh đã chụp lại theo nó → xuất.
  useEffect(() => {
    if (!pendingExport || !blob) return
    if (savedComment !== pendingExport.text || blobComment !== pendingExport.text) return
    setPendingExport(null)
    void exportImage(pendingExport.kind, blob)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exportImage tạo mới mỗi render
  }, [pendingExport, blob, blobComment, savedComment])
  // Lưu xong mà tải lại phiếu lỗi → không chờ ảnh mới mãi: huỷ lệnh xuất, mở khoá nút (QA-4).
  useEffect(() => {
    if (!pendingExport || !query.isError) return
    setPendingExport(null)
    toast.error(t("load_error"))
  }, [pendingExport, query.isError, t])
  const parentToken = notice?.parentLinkToken ?? null

  const openParentLink = () => (linkGate.locked && !parentToken ? linkGate.openUpgrade() : setLinkOpen(true))
  const copyParentLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${parentToken}`)
      toast.success(t("link_copied"))
    } catch {
      toast.error(t("link_copy_failed"))
    }
  }

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
          {/* Có QR payOS (spec AH) thì phiếu đã trả được, không cần TK VietQR. */}
          {!notice.bankConfigured && !notice.qr && notice.remaining > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>{t("notice_no_bank")}</p>
              <Link href="/settings" className="mt-1 inline-block font-medium underline">
                {t("open_settings")}
              </Link>
            </div>
          )}
          {/* Khung cố định 360px để ảnh tải về giữ rộng 360 (thẻ tự co theo khung); màn hẹp hơn thì cuộn ngang trong khung. */}
          <div className="overflow-x-auto">
            <div className="mx-auto w-[360px]">
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
          <div className="space-y-2">
            <label htmlFor="parent-comment" className="text-sm font-medium text-slate-700">
              {t("parent_comment_label")}
            </label>
            <Textarea
              id="parent-comment"
              className="min-h-[88px] text-sm"
              maxLength={2000}
              placeholder={t("parent_comment_placeholder")}
              value={commentValue}
              onChange={(e) => setComment(e.target.value)}
              onBlur={saveComment}
            />
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="h-11 md:h-10"
                disabled={!commentDirty || saveCommentMutation.isPending}
                onClick={saveComment}
              >
                {saveCommentMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("save_comment")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const footer = (
    // Mobile: cụm link phụ huynh 1 hàng riêng, nút ảnh hàng dưới (360px không tràn, QA-2); desktop 1 hàng.
    <div className="flex flex-wrap gap-2 border-t border-slate-200 p-4 md:flex-nowrap md:justify-end">
      <div className="flex w-full gap-2 md:w-auto">
        <Button variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" disabled={!notice} onClick={openParentLink}>
          <Link2 className="mr-2 size-4" />
          {t("parent_link")}
        </Button>
        {parentToken && (
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 md:size-10"
            aria-label={t("copy_parent_link")}
            title={t("copy_parent_link")}
            onClick={copyParentLink}
          >
            <Copy className="size-4" />
          </Button>
        )}
      </div>
      {shareable && (
        <Button
          variant="outline"
          className="h-11 flex-1 md:h-10 md:flex-none"
          disabled={!blob || pendingExport !== null}
          onClick={() => startExport("share")}
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
      {isDesktop ? (
        <Button
          className="h-11 flex-1 md:h-10 md:flex-none"
          disabled={!blob || pendingExport !== null}
          onClick={() => startExport("download")}
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
      ) : (
        <Button
          className="h-11 flex-1 md:h-10 md:flex-none"
          disabled={!blob || pendingExport !== null}
          onClick={() => startExport("view")}
        >
          {blob ? (
            <ImageDown className="mr-2 size-4" />
          ) : captureFailed ? (
            <ImageDown className="mr-2 size-4 opacity-50" />
          ) : (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {t("save_image")}
        </Button>
      )}
    </div>
  )

  return (
    <>
      {isDesktop ? (
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
      ) : (
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
      )}
      {linkOpen && notice && (
        <ParentLinkDialog
          student={{ id: studentId, fullName: notice.fullName, parentLinkToken: parentToken, placeId: notice.placeId }}
          onOpenChange={(open) => !open && setLinkOpen(false)}
          canGenerate={linkGate.allowed}
        />
      )}
      {viewerBlob && (
        <NoticeImageViewer
          blob={viewerBlob}
          filename={filename}
          title={title}
          onClose={() => setViewerBlob(null)}
        />
      )}
    </>
  )
}
