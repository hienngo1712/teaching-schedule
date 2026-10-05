/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideShot } from "@/components/guide/GuideShot"

const listeners: (() => void)[] = []
let mobileNow = false
function setMobile(isMobile: boolean) {
  mobileNow = isMobile
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes("max-width") ? mobileNow : !mobileNow
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
const ui = () =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <GuideShot shot="hoc-phi-mien" alt="Miễn phần còn thiếu" />
    </LanguageProvider>
  )
const figImgs = () => Array.from(screen.getByTestId("guide-shot").querySelectorAll("img"))
const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed")

describe("GuideShot (plan AA)", () => {
  beforeEach(() => {
    listeners.length = 0
    setMobile(false)
  })

  it("chưa chọn: có sẵn 2 ảnh, CSS tự ẩn theo khổ màn (điện thoại không tải ảnh máy tính trước), lazy, có width/height", () => {
    ui()
    const [desktop, mobile] = figImgs()
    expect(figImgs()).toHaveLength(2)
    expect(desktop.getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
    expect(desktop.className).toContain("hidden md:block")
    expect(desktop.getAttribute("width")).toBe("1280")
    expect(mobile.getAttribute("src")).toBe("/guide/hoc-phi-mien-mobile.jpg")
    expect(mobile.className).toContain("md:hidden")
    expect(mobile.getAttribute("width")).toBe("780")
    for (const i of figImgs()) expect(i.getAttribute("loading")).toBe("lazy")
    expect(pressed("Máy tính")).toBe("true")
  })

  it("điện thoại: nút Điện thoại đang chọn", () => {
    setMobile(true)
    ui()
    expect(pressed("Điện thoại")).toBe("true")
    expect(pressed("Máy tính")).toBe("false")
  })

  it("bấm Điện thoại → chỉ còn ảnh mobile; bấm Máy tính → chỉ còn ảnh desktop", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Điện thoại" }))
    expect(figImgs().map((i) => i.getAttribute("src"))).toEqual(["/guide/hoc-phi-mien-mobile.jpg"])
    fireEvent.click(screen.getByRole("button", { name: "Máy tính" }))
    expect(figImgs().map((i) => i.getAttribute("src"))).toEqual(["/guide/hoc-phi-mien-desktop.jpg"])
  })

  it("đã tự chọn thì xoay/đổi khổ màn hình không đè lựa chọn", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Điện thoại" }))
    // Xoay sang khổ điện thoại rồi về lại khổ máy tính.
    for (const m of [true, false]) {
      mobileNow = m
      act(() => listeners.forEach((fn) => fn()))
    }
    expect(pressed("Điện thoại")).toBe("true")
    expect(figImgs().map((i) => i.getAttribute("src"))).toEqual(["/guide/hoc-phi-mien-mobile.jpg"])
  })

  it("bấm Phóng to → hộp có ảnh đang chọn, không đọc lặp mô tả", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Phóng to ảnh" }))
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelector("img")!.getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
    expect(dialog.getAttribute("aria-describedby")).toBeNull()
  })

  it("phóng to ảnh điện thoại: rộng tối đa 390px nhưng không vượt khung hộp (không cuộn ngang)", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Điện thoại" }))
    fireEvent.click(screen.getByRole("button", { name: "Phóng to ảnh" }))
    const zoomed = screen.getByRole("dialog").querySelector("img")!
    expect(zoomed.getAttribute("src")).toBe("/guide/hoc-phi-mien-mobile.jpg")
    expect(zoomed.className).toContain("w-full")
    expect(zoomed.className).toContain("max-w-[390px]")
  })
})
