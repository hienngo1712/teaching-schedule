"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { MISSING_STEPS, TOURS, TOUR_FIRST_WAIT_MS, TOUR_PARAM, parseTourParam, tourHref, type TourStep } from "@/lib/tours"
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
  // Mỗi lần chạy 1 số; đổi trang / lần chạy mới / StrictMode unmount làm lần cũ còn đang tải tự bỏ.
  const runId = useRef(0)
  const raw = params.get(TOUR_PARAM)

  // Chuyển trang thì tắt tour đang chạy, kể cả lần còn đang tải (chưa có handle).
  // stop() trước rồi mới tăng runId: end() của tour đang chạy phải còn khớp số để dọn handle.
  useEffect(
    () => () => {
      handle.current?.stop()
      runId.current++
      setTourActive(false)
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
    const my = ++runId.current
    handle.current?.stop()
    setTourActive(true)
    const end = () => {
      if (my !== runId.current) return
      handle.current = null
      setTourActive(false)
    }

    void (async () => {
      try {
        const tour = TOURS[id]
        let steps: TourStep[] = tour.steps
        if (tour.requires) {
          // Cache 60s có thể còn "chưa có ca" dù vừa tạo ca xong.
          const status = await utils.onboarding.status.fetch(undefined, { staleTime: 0 })
          if (my !== runId.current) return
          if (!status.steps[tour.requires]) steps = [MISSING_STEPS[tour.requires]]
        }
        const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")])
        if (my !== runId.current) return
        const drv = driver({
          overlayOpacity: 0.5,
          stagePadding: 4,
          stageRadius: 10,
          popoverClass: "app-tour",
          allowClose: true,
          disableActiveInteraction: false,
          // Esc / bấm ra lớp phủ: onDestroyed bị bỏ qua nếu bấm trong ~400ms hiệu ứng đầu, onDestroyStarted thì luôn gọi.
          // stop() gọi destroy() kiểu không kích hook nên không lặp.
          onDestroyStarted: () => (handle.current ? handle.current.stop() : drv.destroy()),
        })
        handle.current = runTour({
          driver: drv,
          steps,
          t,
          onMissingClickTarget: () => toast(t("tour_target_missing")),
          onStartTour: (next) => router.push(tourHref(next)),
          onEnd: end,
          firstWaitMs: TOUR_FIRST_WAIT_MS,
        })
      } catch {
        if (my !== runId.current) return
        toast(t("tour_load_error"))
        end()
      }
    })()
    // Chỉ phản ứng khi giá trị ?tour= đổi; router.replace làm raw về null nhưng không được huỷ tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw])

  return null
}
