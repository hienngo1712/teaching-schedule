"use client"

import { useState } from "react"
import { Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { GUIDE_SHOT_SIZE, guideShotSrc, type GuideShotKind } from "@/lib/guide-content"

const KINDS: GuideShotKind[] = ["desktop", "mobile"]
// Chưa chọn: CSS tự ẩn ảnh sai khổ; ảnh lazy bị ẩn không tải nên điện thoại không tốn ảnh máy tính.
const AUTO_CLASS: Record<GuideShotKind, string> = { desktop: "hidden md:block w-full", mobile: "md:hidden max-w-[240px]" }
const PICKED_CLASS: Record<GuideShotKind, string> = { desktop: "w-full", mobile: "max-w-[240px]" }

export function GuideShot({ shot, alt }: { shot: string; alt: string }) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery("(max-width: 767px)")
  // null = theo thiết bị; người dùng bấm chọn thì giữ nguyên dù xoay màn hình.
  const [picked, setPicked] = useState<GuideShotKind | null>(null)
  const [zoom, setZoom] = useState(false)
  const active: GuideShotKind = picked ?? (isMobile ? "mobile" : "desktop")
  const shown = picked ? [picked] : KINDS
  const tab = (k: GuideShotKind, label: string) => (
    <button
      type="button"
      aria-pressed={active === k}
      onClick={() => setPicked(k)}
      className={`h-11 rounded-md px-3 text-sm font-medium md:h-8 ${active === k ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  )
  return (
    <figure data-testid="guide-shot" className="mt-2 rounded-lg border bg-slate-50 p-2 print:hidden">
      <div className="mb-2 flex items-center gap-1">
        {tab("desktop", t("guide_shot_desktop"))}
        {tab("mobile", t("guide_shot_mobile"))}
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label={t("guide_shot_zoom")}
          className="ml-auto flex size-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:size-8"
        >
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={() => setZoom(true)} className="block w-full" tabIndex={-1}>
        {shown.map((k) => (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh đã nén sẵn, không tốn quota tối ưu ảnh của Vercel
          <img
            key={k}
            src={guideShotSrc(shot, k)}
            alt={alt}
            width={GUIDE_SHOT_SIZE[k].width}
            height={GUIDE_SHOT_SIZE[k].height}
            loading="lazy"
            className={`mx-auto h-auto rounded border bg-white ${picked ? PICKED_CLASS[k] : AUTO_CLASS[k]}`}
          />
        ))}
      </button>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent aria-describedby={undefined} className="max-h-[95vh] max-w-[95vw] overflow-auto p-2 sm:max-w-5xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- như trên */}
          <img
            src={guideShotSrc(shot, active)}
            alt={alt}
            width={GUIDE_SHOT_SIZE[active].width}
            height={GUIDE_SHOT_SIZE[active].height}
            className={`mx-auto h-auto w-full ${active === "mobile" ? "max-w-[390px]" : ""}`}
          />
        </DialogContent>
      </Dialog>
    </figure>
  )
}
