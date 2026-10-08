"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { trpc } from "@/lib/trpc"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { hasUnseenRelease, latestNotifyRelease, shortVersion } from "@/lib/releases"
import { useTourActive } from "@/lib/tour-store"
import { WhatsNewPanel } from "./WhatsNewPanel"

export function WhatsNew() {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const utils = trpc.useUtils()
  const { data } = trpc.release.status.useQuery()
  // Lỗi mạng: lần tải sau ô mở lại, không làm phiền bằng toast (spec W §5.4).
  const markSeen = trpc.release.markSeen.useMutation()
  const [open, setOpen] = useState(false)
  const autoOpened = useRef(false)
  const latest = latestNotifyRelease()
  const unseen = data !== undefined && hasUnseenRelease(data.lastSeenRelease)

  const tourActive = useTourActive()
  useEffect(() => {
    // Đang chạy tour thì để sau, tour tắt mới tự mở (spec AD §4.2).
    if (!unseen || autoOpened.current || tourActive) return
    // Tour vừa tắt mà hộp (vd Thêm học sinh) còn mở: chờ hộp đóng rồi mới mở, không đè lên.
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return false
      autoOpened.current = true
      setOpen(true)
      return true
    }
    if (tryOpen()) return
    const id = setInterval(() => {
      if (tryOpen()) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [unseen, tourActive])

  if (!latest) return null

  function change(next: boolean) {
    setOpen(next)
    if (next || !unseen || !latest) return
    utils.release.status.setData(undefined, { lastSeenRelease: latest.version })
    markSeen.mutate({ version: latest.version })
  }

  const trigger = (extra?: React.ComponentProps<typeof Button>) => (
    <Button variant="outline" className="relative h-11 gap-2 px-3 text-slate-700 md:h-10" aria-label={t("whatsnew_button")} {...extra}>
      <Sparkles className="size-5 text-primary" aria-hidden />
      <span className="hidden md:inline">{t("whatsnew_button")}</span>
      <span className="hidden rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary md:inline">{shortVersion(latest.version)}</span>
      {unseen && <span data-testid="whatsnew-dot" className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-white" />}
    </Button>
  )
  const panel = <WhatsNewPanel release={latest} onClose={() => change(false)} />

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={change}>
        <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
        <PopoverContent aria-label={t("whatsnew_button")} align="end" className="w-[340px] max-w-[calc(100vw-2rem)] p-0">{panel}</PopoverContent>
      </Popover>
    )
  }
  return (
    <>
      {trigger({ onClick: () => change(true), "aria-haspopup": "dialog", "aria-expanded": open })}
      <Sheet open={open} onOpenChange={change}>
        <SheetContent side="bottom" hideClose className="max-h-[85vh] overflow-y-auto p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">{t("whatsnew_button")}</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
    </>
  )
}
