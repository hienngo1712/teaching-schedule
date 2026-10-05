"use client"

import { useEffect, useState } from "react"
import { Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { GUIDE_SHOT_SIZE, guideShotSrc, type GuideShotKind } from "@/lib/guide-content"

export function GuideShot({ shot, alt }: { shot: string; alt: string }) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [kind, setKind] = useState<GuideShotKind>("desktop")
  const [zoom, setZoom] = useState(false)
  // Mặc định theo thiết bị người xem; useMediaQuery trả false ở lần render đầu nên đồng bộ sau.
  useEffect(() => setKind(isMobile ? "mobile" : "desktop"), [isMobile])
  const size = GUIDE_SHOT_SIZE[kind]
  const src = guideShotSrc(shot, kind)
  const tab = (k: GuideShotKind, label: string) => (
    <button
      type="button"
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={`h-11 rounded-md px-3 text-sm font-medium md:h-8 ${kind === k ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
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
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh đã nén sẵn, không tốn quota tối ưu ảnh của Vercel */}
        <img
          src={src}
          alt={alt}
          width={size.width}
          height={size.height}
          loading="lazy"
          className={`mx-auto h-auto rounded border bg-white ${kind === "mobile" ? "max-w-[240px]" : "w-full"}`}
        />
      </button>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-auto p-2 sm:max-w-5xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">{alt}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- như trên */}
          <img src={src} alt={alt} width={size.width} height={size.height} className={`mx-auto h-auto ${kind === "mobile" ? "max-w-[390px]" : "w-full"}`} />
        </DialogContent>
      </Dialog>
    </figure>
  )
}
