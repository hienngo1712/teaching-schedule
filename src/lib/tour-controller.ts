import { TOUR_POLL_MS, TOUR_WAIT_MS, type TourId, type TourKey, type TourStep } from "./tours"

type PopoverButton = "next" | "previous" | "close"
type HighlightStep = {
  element?: Element
  popover: {
    title: string
    description: string
    showButtons: PopoverButton[]
    nextBtnText: string
    prevBtnText: string
    onNextClick: () => void
    onPrevClick: () => void
    onCloseClick: () => void
  }
}
// Phần dùng tới của Driver (driver.js); khai báo tại chỗ để test dùng driver giả.
export type TourDriver = { highlight: (step: HighlightStep) => void; destroy: () => void; isActive: () => boolean }

export type RunTourOptions = {
  driver: TourDriver
  steps: TourStep[]
  t: (key: TourKey) => string
  waitMs?: number
  onMissingClickTarget: () => void
  onStartTour: (id: TourId) => void
  onEnd: () => void
}
export type TourHandle = { stop: () => void }

// Mobile và desktop có thể cùng gắn 1 data-tour cho 2 nút; lấy nút đang hiện.
export function findVisibleTarget(target: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  for (const el of Array.from(els)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function waitForTarget(target: string, timeoutMs: number, isStopped: () => boolean): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = Date.now()
    const tick = () => {
      if (isStopped()) return resolve(null)
      const el = findVisibleTarget(target)
      if (el) return resolve(el)
      if (Date.now() - started >= timeoutMs) return resolve(null)
      setTimeout(tick, TOUR_POLL_MS)
    }
    tick()
  })
}

export function runTour(opts: RunTourOptions): TourHandle {
  const { driver, steps, t, waitMs = TOUR_WAIT_MS } = opts
  let stopped = false
  let current: HTMLElement | null = null
  let removeClick: (() => void) | null = null
  const shown: number[] = []
  // Hộp chứa bước hiện tại bị đóng thì phần tử rời khỏi DOM → tắt tour.
  const watch = setInterval(() => {
    if (current && !current.isConnected) stop()
  }, 500)

  function clearStep() {
    removeClick?.()
    removeClick = null
    current = null
  }

  function stop() {
    if (stopped) return
    stopped = true
    clearInterval(watch)
    clearStep()
    if (driver.isActive()) driver.destroy()
    opts.onEnd()
  }

  async function show(i: number): Promise<void> {
    clearStep()
    if (stopped) return
    if (i >= steps.length) return stop()
    const step = steps[i]
    let el: HTMLElement | undefined
    if (step.target) {
      const found = await waitForTarget(step.target, waitMs, () => stopped)
      if (stopped) return
      if (!found) {
        if (step.advanceOn === "click") {
          opts.onMissingClickTarget()
          return stop()
        }
        return show(i + 1)
      }
      el = found
    }
    shown.push(i)
    const isClick = step.advanceOn === "click"
    const isLast = i === steps.length - 1
    const buttons: PopoverButton[] = isClick ? ["close"] : shown.length > 1 ? ["previous", "next", "close"] : ["next", "close"]
    driver.highlight({
      element: el,
      popover: {
        title: `${i + 1}/${steps.length} · ${t(step.titleKey)}`,
        description: isClick ? `${t(step.bodyKey)} ${t("tour_click_hint")}` : t(step.bodyKey),
        showButtons: buttons,
        nextBtnText: step.nextLabelKey ? t(step.nextLabelKey) : isLast ? t("tour_done") : t("tour_next"),
        prevBtnText: t("tour_prev"),
        onNextClick: () => {
          if (step.nextTour) {
            const next = step.nextTour
            stop()
            opts.onStartTour(next)
            return
          }
          void show(i + 1)
        },
        onPrevClick: () => {
          shown.pop()
          const prev = shown.pop()
          if (prev !== undefined) void show(prev)
        },
        onCloseClick: () => stop(),
      },
    })
    current = el ?? null
    if (isClick && el) {
      const target = el
      const onClick = () => void show(i + 1)
      target.addEventListener("click", onClick, { once: true })
      removeClick = () => target.removeEventListener("click", onClick)
    }
  }

  void show(0)
  return { stop }
}
