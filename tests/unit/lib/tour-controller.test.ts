/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { findVisibleTarget, runTour, type RunTourOptions, type TourDriver } from "@/lib/tour-controller"
import type { TourStep } from "@/lib/tours"

type HighlightArg = { element?: Element; popover: { title: string; description: string; showButtons: string[]; nextBtnText: string; onNextClick: () => void; onPrevClick: () => void; onCloseClick: () => void } }

function fakeDriver() {
  let active = false
  const calls: HighlightArg[] = []
  const driver = {
    highlight: vi.fn((arg: HighlightArg) => { active = true; calls.push(arg) }),
    destroy: vi.fn(() => { active = false }),
    refresh: vi.fn(),
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

// Tour test trước chưa tắt vẫn còn listener phím trên document: tắt hết sau mỗi test.
const handles: { stop: () => void }[] = []

function setup(steps: TourStep[], extra: Partial<Pick<RunTourOptions, "firstWaitMs">> = {}) {
  const { driver, calls } = fakeDriver()
  const onMissingClickTarget = vi.fn()
  const onStartTour = vi.fn()
  const onEnd = vi.fn()
  const handle = runTour({ driver, steps, t: t as never, onMissingClickTarget, onStartTour, onEnd, ...extra })
  handles.push(handle)
  return { driver, calls, onMissingClickTarget, onStartTour, onEnd, handle }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  handles.splice(0).forEach((h) => h.stop())
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

  it("bước ngay sau bước 👆 không có nút Quay lại (quay lại sẽ chỉ vào nút sau hộp đang mở)", async () => {
    const a = addTarget("a")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "c", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    a.click()
    addTarget("b")
    addTarget("c")
    await vi.advanceTimersByTimeAsync(200)
    expect(calls[1].popover.showButtons).toEqual(["next", "close"])
    calls[1].popover.onNextClick()
    await flush()
    expect(calls[2].popover.showButtons).toEqual(["previous", "next", "close"])
  })

  it("bấm 👆 mà hộp không mở (vd gói bị khoá mở hộp nâng cấp): tắt tour, không bỏ qua dần từng bước", async () => {
    const a = addTarget("a")
    addTarget("c")
    const { calls, onEnd, onMissingClickTarget } = setup([
      { target: "a", titleKey: "tour_import_2_title", bodyKey: "tour_import_2_body", advanceOn: "click" },
      { target: "b", titleKey: "tour_import_3_title", bodyKey: "tour_import_3_body" },
      { target: "c", titleKey: "tour_import_4_title", bodyKey: "tour_import_4_body" },
    ])
    await flush()
    a.click()
    await vi.advanceTimersByTimeAsync(3200)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
    expect(onMissingClickTarget).not.toHaveBeenCalled()
  })

  it("bấm Tiếp 2 lần khi bước sau còn đang chờ: chỉ chạy 1 lần, Quay lại vẫn đúng", async () => {
    const a = addTarget("a")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    calls[0].popover.onNextClick()
    calls[0].popover.onNextClick()
    addTarget("b")
    await vi.advanceTimersByTimeAsync(200)
    expect(calls).toHaveLength(2)
    calls[1].popover.onPrevClick()
    await flush()
    expect(calls[2].element).toBe(a)
  })

  it("bước 👆 là cả dòng: bấm nút con trong dòng không tính, bấm vào dòng mới đi tiếp", async () => {
    const row = document.createElement("div")
    row.setAttribute("data-tour", "row")
    row.getBoundingClientRect = () => ({ width: 10, height: 10, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) })
    const inner = document.createElement("button")
    row.appendChild(inner)
    const cell = document.createElement("span")
    row.appendChild(cell)
    document.body.appendChild(row)
    const b = addTarget("b")
    const { calls } = setup([
      { target: "row", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ])
    await flush()
    inner.click()
    await vi.advanceTimersByTimeAsync(200)
    expect(calls).toHaveLength(1)
    cell.click()
    await vi.advanceTimersByTimeAsync(200)
    expect(calls[1].element).toBe(b)
  })

  it("bước đầu chờ theo firstWaitMs (trang tải nguội), bước sau vẫn 3 giây", async () => {
    const { calls, onEnd } = setup([
      { target: "late", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
      { target: "missing", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ], { firstWaitMs: 8000 })
    await vi.advanceTimersByTimeAsync(5000)
    addTarget("late")
    await vi.advanceTimersByTimeAsync(200)
    expect(calls).toHaveLength(1)
    calls[0].popover.onNextClick()
    await vi.advanceTimersByTimeAsync(2900)
    expect(onEnd).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    // Bước 2 thiếu → bỏ qua sau 3s (không phải 8s) → hết bước, tour tắt.
    expect(calls).toHaveLength(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("mũi tên phải = Tiếp, trái = Quay lại", async () => {
    addTarget("a"); addTarget("b")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ])
    await flush()
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flush()
    expect(calls).toHaveLength(2)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
    await flush()
    expect(calls).toHaveLength(3)
    expect(calls[2].popover.title).toContain("1/2")
  })

  it("mũi tên trong ô nhập không chuyển bước; bước 👆 không có Tiếp nên mũi tên không làm gì", async () => {
    addTarget("a"); addTarget("b")
    const input = document.createElement("input")
    document.body.appendChild(input)
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body", advanceOn: "click" },
    ])
    await flush()
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flush()
    expect(calls).toHaveLength(1)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flush()
    expect(calls).toHaveLength(2)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flush()
    expect(calls).toHaveLength(2)
  })

  it("mũi tên trong lưới lịch chọn ngày (role=grid) và Alt+mũi tên (Quay lại của trình duyệt) không chuyển bước", async () => {
    addTarget("a"); addTarget("b")
    const grid = document.createElement("div")
    grid.setAttribute("role", "grid")
    const day = document.createElement("button")
    grid.appendChild(day)
    document.body.appendChild(grid)
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ])
    await flush()
    day.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }))
    await flush()
    expect(calls).toHaveLength(1)
  })

  it("bước pageArrows: mũi tên để cho trang (chuyển ca), tour không nhảy bước, không chặn phím", async () => {
    addTarget("a"); addTarget("b"); addTarget("c")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body", pageArrows: true },
      { target: "c", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    calls[0].popover.onNextClick()
    await flush()
    expect(calls).toHaveLength(2)
    for (const key of ["ArrowRight", "ArrowLeft"]) {
      const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      document.body.dispatchEvent(e)
      expect(e.defaultPrevented).toBe(false)
    }
    await flush()
    expect(calls).toHaveLength(2)
    // Nút Tiếp trên hộp tour vẫn đi tiếp.
    calls[1].popover.onNextClick()
    await flush()
    expect(calls).toHaveLength(3)
  })

  // Hiệu ứng chuyển bước của driver.js (~400ms) còn giữ phần tử cũ: vẽ lại thêm lượt sau, khi vị trí đã đứng yên.
  it("phần tử đang tô sáng dời chỗ (hộp co lại khi đổi ca) thì vẽ lại khung sáng + hộp tour", async () => {
    const a = addTarget("a")
    const { driver } = setup([{ target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" }])
    await flush()
    await vi.advanceTimersByTimeAsync(600)
    expect(driver.refresh).not.toHaveBeenCalled()
    a.getBoundingClientRect = () => ({ width: 10, height: 10, top: 80, left: 0, right: 10, bottom: 90, x: 0, y: 80, toJSON: () => ({}) })
    await vi.advanceTimersByTimeAsync(500)
    expect(driver.refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(driver.refresh).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(driver.refresh).toHaveBeenCalledTimes(2)
  })

  it("bước hiện lúc hộp còn đang trượt vào: dời chỗ trước lượt kiểm đầu vẫn vẽ lại", async () => {
    const a = addTarget("a")
    const { driver } = setup([{ target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" }])
    await flush()
    a.getBoundingClientRect = () => ({ width: 10, height: 10, top: 80, left: 0, right: 10, bottom: 90, x: 0, y: 80, toJSON: () => ({}) })
    await vi.advanceTimersByTimeAsync(1100)
    expect(driver.refresh).toHaveBeenCalledTimes(2)
  })

  it("tour tắt thì gỡ listener phím", async () => {
    addTarget("a"); addTarget("b")
    const { calls, handle } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ])
    await flush()
    handle.stop()
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flush()
    expect(calls).toHaveLength(1)
  })
})
