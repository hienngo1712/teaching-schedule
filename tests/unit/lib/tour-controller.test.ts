/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { findVisibleTarget, runTour, type TourDriver } from "@/lib/tour-controller"
import type { TourStep } from "@/lib/tours"

type HighlightArg = { element?: Element; popover: { title: string; description: string; showButtons: string[]; nextBtnText: string; onNextClick: () => void; onPrevClick: () => void; onCloseClick: () => void } }

function fakeDriver() {
  let active = false
  const calls: HighlightArg[] = []
  const driver = {
    highlight: vi.fn((arg: HighlightArg) => { active = true; calls.push(arg) }),
    destroy: vi.fn(() => { active = false }),
    isActive: vi.fn(() => active),
  }
  return { driver: driver as unknown as TourDriver & typeof driver, calls }
}

// jsdom không tính layout: giả kích thước để "đang hiển thị".
function addTarget(name: string, visible = true) {
  const el = document.createElement("button")
  el.setAttribute("data-tour", name)
  el.getBoundingClientRect = () => ({ width: visible ? 10 : 0, height: visible ? 10 : 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) })
  document.body.appendChild(el)
  return el
}

const t = (k: string) => k
const flush = () => vi.advanceTimersByTimeAsync(0)

function setup(steps: TourStep[]) {
  const { driver, calls } = fakeDriver()
  const onMissingClickTarget = vi.fn()
  const onStartTour = vi.fn()
  const onEnd = vi.fn()
  const handle = runTour({ driver, steps, t: t as never, onMissingClickTarget, onStartTour, onEnd })
  return { driver, calls, onMissingClickTarget, onStartTour, onEnd, handle }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("findVisibleTarget", () => {
  it("bỏ phần tử ẩn, lấy phần tử đang hiện", () => {
    addTarget("x", false)
    const shown = addTarget("x", true)
    expect(findVisibleTarget("x")).toBe(shown)
    expect(findVisibleTarget("y")).toBeNull()
  })
})

describe("runTour", () => {
  it("bước thường: Tiếp sang bước sau; bước cuối nút Xong rồi tắt + onEnd", async () => {
    const a = addTarget("a")
    const b = addTarget("b")
    const { calls, driver, onEnd } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    expect(calls[0].element).toBe(a)
    expect(calls[0].popover.title).toBe("1/2 · tour_student_2_title")
    expect(calls[0].popover.showButtons).toEqual(["next", "close"])
    expect(calls[0].popover.nextBtnText).toBe("tour_next")
    calls[0].popover.onNextClick()
    await flush()
    expect(calls[1].element).toBe(b)
    expect(calls[1].popover.showButtons).toEqual(["previous", "next", "close"])
    expect(calls[1].popover.nextBtnText).toBe("tour_done")
    calls[1].popover.onNextClick()
    await flush()
    expect(driver.destroy).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("Quay lại về bước đã hiện trước đó", async () => {
    const a = addTarget("a")
    addTarget("b")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    calls[0].popover.onNextClick()
    await flush()
    calls[1].popover.onPrevClick()
    await flush()
    expect(calls[2].element).toBe(a)
  })

  it("bước 👆: không có nút Tiếp, chờ người dùng bấm phần tử rồi đi tiếp", async () => {
    const a = addTarget("a")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ])
    await flush()
    expect(calls[0].popover.showButtons).toEqual(["close"])
    expect(calls[0].popover.description).toBe("tour_student_1_body tour_click_hint")
    a.click()
    const b = addTarget("b") // hộp mở sau khi bấm
    await vi.advanceTimersByTimeAsync(200)
    expect(calls[1].element).toBe(b)
  })

  it("bước thường thiếu phần tử quá 3 giây thì bỏ qua", async () => {
    const c = addTarget("c")
    const { calls } = setup([
      { target: "missing", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "c", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await vi.advanceTimersByTimeAsync(2900)
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(300)
    expect(calls[0].element).toBe(c)
  })

  it("bước 👆 thiếu phần tử: báo + tắt, onEnd được gọi dù chưa hiện bước nào", async () => {
    const { calls, onMissingClickTarget, onEnd } = setup([
      { target: "missing", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
    ])
    await vi.advanceTimersByTimeAsync(3200)
    expect(calls).toHaveLength(0)
    expect(onMissingClickTarget).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("bước báo thiếu dữ liệu: khung giữa màn, nút Tiếp mang nhãn riêng và chuyển tour", async () => {
    const { calls, onStartTour, onEnd } = setup([
      { target: null, titleKey: "tour_need_session_title", bodyKey: "tour_need_session_body", nextTour: "session", nextLabelKey: "tour_need_session_next" },
    ])
    await flush()
    expect(calls[0].element).toBeUndefined()
    expect(calls[0].popover.nextBtnText).toBe("tour_need_session_next")
    calls[0].popover.onNextClick()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onStartTour).toHaveBeenCalledWith("session")
  })

  it("phần tử đang tô sáng bị gỡ khỏi trang (đóng hộp) thì tắt tour", async () => {
    const a = addTarget("a")
    addTarget("b")
    const { onEnd } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    a.remove()
    await vi.advanceTimersByTimeAsync(600)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("stop gọi nhiều lần chỉ kết thúc 1 lần; nút X tắt tour", async () => {
    addTarget("a")
    const { calls, handle, onEnd } = setup([{ target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" }])
    await flush()
    calls[0].popover.onCloseClick()
    handle.stop()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
