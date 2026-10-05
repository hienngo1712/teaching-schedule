/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideShot } from "@/components/guide/GuideShot"

function setMobile(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("max-width") ? isMobile : !isMobile,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
const ui = () =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <GuideShot shot="hoc-phi-mien" alt="Miễn phần còn thiếu" />
    </LanguageProvider>
  )
const img = () => screen.getAllByRole("img", { name: "Miễn phần còn thiếu" })[0] as HTMLImageElement

describe("GuideShot (plan AA)", () => {
  beforeEach(() => setMobile(false))

  it("máy tính: mặc định ảnh desktop, lazy, có width/height", () => {
    ui()
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
    expect(img().getAttribute("loading")).toBe("lazy")
    expect(img().getAttribute("width")).toBe("1280")
    expect(screen.getByRole("button", { name: "Máy tính" }).getAttribute("aria-pressed")).toBe("true")
  })

  it("điện thoại: mặc định ảnh mobile", () => {
    setMobile(true)
    ui()
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-mobile.jpg")
    expect(screen.getByRole("button", { name: "Điện thoại" }).getAttribute("aria-pressed")).toBe("true")
  })

  it("bấm Điện thoại → đổi ảnh; bấm Máy tính → đổi lại", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Điện thoại" }))
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-mobile.jpg")
    fireEvent.click(screen.getByRole("button", { name: "Máy tính" }))
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
  })

  it("bấm Phóng to → mở hộp có ảnh đang chọn", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Phóng to ảnh" }))
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelector("img")!.getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
  })
})
