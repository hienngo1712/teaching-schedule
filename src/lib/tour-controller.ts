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
// Ô nhập / vùng tự xử lý mũi tên: không cướp phím làm nhảy bước.
const KEY_OWNERS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="radio"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="grid"], [role="treeitem"]'
// Bước 👆 trên cả dòng: bấm phần tử bấm được bên trong dòng (Đã đóng đủ, Phiếu báo) không tính là bấm dòng.
const NESTED_INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="checkbox"]'

// Phần dùng tới của Driver (driver.js); khai báo tại chỗ để test dùng driver giả.
export type TourDriver = { highlight: (step: HighlightStep) => void; destroy: () => void; isActive: () => boolean }

export type RunTourOptions = {
  driver: TourDriver
  steps: TourStep[]
  t: (key: TourKey) => string
  waitMs?: number
  firstWaitMs?: number
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
  let nextWait = opts.firstWaitMs ?? waitMs
  let keyNav: { next?: () => void; prev?: () => void } = {}
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    // Alt+← là Quay lại của trình duyệt: không cướp tổ hợp phím.
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if ((e.target as Element | null)?.closest?.(KEY_OWNERS)) return
    const fn = e.key === "ArrowRight" ? keyNav.next : keyNav.prev
    if (!fn) return
    e.preventDefault()
    fn()
  }
  // driver.js chỉ nghe mũi tên khi chạy kiểu nhiều bước; highlight() từng bước thì phải tự nghe.
  document.addEventListener("keydown", onKey, true)
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
    keyNav = {}
  }

  function stop() {
    if (stopped) return
    stopped = true
    clearInterval(watch)
    document.removeEventListener("keydown", onKey, true)
    clearStep()
    if (driver.isActive()) driver.destroy()
    opts.onEnd()
  }

  // Bấm Tiếp liên tục khi bước sau còn đang chờ: chỉ chuỗi show mới nhất được chạy tiếp.
  let seq = 0

  async function show(i: number, afterClick = false): Promise<void> {
    clearStep()
    if (stopped) return
    if (i >= steps.length) return stop()
    const my = ++seq
    const step = steps[i]
    let el: HTMLElement | undefined
    if (step.target) {
      const found = await waitForTarget(step.target, nextWait, () => stopped)
      nextWait = waitMs
      if (stopped || my !== seq) return
      if (!found) {
        if (step.advanceOn === "click") {
          opts.onMissingClickTarget()
          return stop()
        }
        // Bấm mở hộp mà hộp không hiện (vd gói khoá mở hộp nâng cấp): tắt hẳn, đừng để lớp phủ che hộp kia.
        if (afterClick) return stop()
        return show(i + 1)
      }
      el = found
    }
    shown.push(i)
    const isClick = step.advanceOn === "click"
    const isLast = i === steps.length - 1
    const buttons: PopoverButton[] = isClick ? ["close"] : shown.length > 1 ? ["previous", "next", "close"] : ["next", "close"]
    const onNext = () => {
      if (step.nextTour) {
        const next = step.nextTour
        stop()
        opts.onStartTour(next)
        return
      }
      void show(i + 1)
    }
    const onPrev = () => {
      shown.pop()
      const prev = shown.pop()
      if (prev !== undefined) void show(prev)
    }
    driver.highlight({
      element: el,
      popover: {
        title: `${i + 1}/${steps.length} · ${t(step.titleKey)}`,
        description: isClick ? `${t(step.bodyKey)} ${t("tour_click_hint")}` : t(step.bodyKey),
        showButtons: buttons,
        nextBtnText: step.nextLabelKey ? t(step.nextLabelKey) : isLast ? t("tour_done") : t("tour_next"),
        prevBtnText: t("tour_prev"),
        onNextClick: onNext,
        onPrevClick: onPrev,
        onCloseClick: () => stop(),
      },
    })
    keyNav = step.pageArrows
      ? {}
      : { next: buttons.includes("next") ? onNext : undefined, prev: buttons.includes("previous") ? onPrev : undefined }
    current = el ?? null
    if (isClick && el) {
      const target = el
      const onClick = (e: Event) => {
        const hit = (e.target as Element | null)?.closest?.(NESTED_INTERACTIVE)
        if (hit && hit !== target && target.contains(hit)) return
        target.removeEventListener("click", onClick)
        // Bước 👆 là mốc: Quay lại không được chỉ vào nút nằm sau hộp vừa mở.
        shown.length = 0
        void show(i + 1, true)
      }
      target.addEventListener("click", onClick)
      removeClick = () => target.removeEventListener("click", onClick)
    }
  }

  void show(0)
  return { stop }
}
