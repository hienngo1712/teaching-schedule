"use client"

import "driver.js/dist/driver.css"
import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { MISSING_STEPS, TOURS, TOUR_PARAM, parseTourParam, tourHref, type TourStep } from "@/lib/tours"
import { runTour, type TourHandle } from "@/lib/tour-controller"
import { setTourActive } from "@/lib/tour-store"

// Chạy tour khi URL có ?tour=<id> (nút "Chỉ cho tôi"), spec AD §4.2.
export function TourRunner() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const handle = useRef<TourHandle | null>(null)
  const alive = useRef(true)
  const raw = params.get(TOUR_PARAM)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Chuyển trang thì tắt tour đang chạy.
  useEffect(
    () => () => {
      handle.current?.stop()
    },
    [pathname]
  )

  useEffect(() => {
    if (raw === null) return
    const rest = new URLSearchParams(params.toString())
    rest.delete(TOUR_PARAM)
    const qs = rest.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })

    const id = parseTourParam(raw)
    if (!id) return
    if (document.querySelector('[role="dialog"][data-state="open"]')) {
      toast(t("tour_close_dialog_first"))
      return
    }
    handle.current?.stop()
    setTourActive(true)
    const end = () => {
      handle.current = null
      setTourActive(false)
    }

    void (async () => {
      try {
        const tour = TOURS[id]
        let steps: TourStep[] = tour.steps
        if (tour.requires) {
          const status = await utils.onboarding.status.fetch()
          if (!status.steps[tour.requires]) steps = [MISSING_STEPS[tour.requires]]
        }
        const { driver } = await import("driver.js")
        if (!alive.current) return end()
        const drv = driver({
          overlayOpacity: 0.5,
          stagePadding: 4,
          stageRadius: 10,
          popoverClass: "app-tour",
          allowClose: true,
          disableActiveInteraction: false,
          // Esc hoặc bấm ra lớp phủ: driver tự huỷ → dọn controller.
          onDestroyed: () => handle.current?.stop(),
        })
        handle.current = runTour({
          driver: drv,
          steps,
          t,
          onMissingClickTarget: () => toast(t("tour_target_missing")),
          onStartTour: (next) => router.push(tourHref(next)),
          onEnd: end,
        })
      } catch {
        end()
      }
    })()
    // Chỉ phản ứng khi giá trị ?tour= đổi; router.replace làm raw về null nhưng không được huỷ tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw])

  return null
}
