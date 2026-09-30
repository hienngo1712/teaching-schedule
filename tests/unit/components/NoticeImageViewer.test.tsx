/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { NoticeImageViewer } from "@/components/tuition/NoticeImageViewer"
import * as shareImage from "@/lib/share-image"

vi.mock("@/lib/share-image", async () => {
  const actual = await vi.importActual<typeof import("@/lib/share-image")>("@/lib/share-image")
  return {
    ...actual,
    canShareFiles: vi.fn(),
    shareOrDownloadPng: vi.fn(),
  }
})

describe("NoticeImageViewer (spec S3)", () => {
  const blob = new Blob(["dummy"], { type: "image/png" })

  beforeEach(() => {
    vi.clearAllMocks()
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:x")
    window.URL.revokeObjectURL = vi.fn()
  })

  it("render ảnh img src blob:x, text hướng dẫn lưu, unmount thì revokeObjectURL", () => {
    vi.mocked(shareImage.canShareFiles).mockReturnValue(false)
    const onClose = vi.fn()

    const { unmount } = render(
      <LanguageProvider forcedLanguage="vi">
        <NoticeImageViewer blob={blob} filename="test.png" title="Phiếu báo" onClose={onClose} />
      </LanguageProvider>
    )

    const img = screen.getByRole("img")
    expect(img.getAttribute("src")).toBe("blob:x")
    expect(screen.getByText(/Nhấn giữ ảnh → chọn Lưu vào Ảnh/)).toBeDefined()

    // Bấm nút Đóng
    const closeBtn = screen.getByRole("button", { name: /Đóng/ })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    // Unmount
    unmount()
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:x")
  })

  it("canShareFiles true → có nút Mở bảng chia sẻ, bấm gọi shareOrDownloadPng", () => {
    vi.mocked(shareImage.canShareFiles).mockReturnValue(true)
    const onClose = vi.fn()

    render(
      <LanguageProvider forcedLanguage="vi">
        <NoticeImageViewer blob={blob} filename="phieu.png" title="Phiếu tháng 5" onClose={onClose} />
      </LanguageProvider>
    )

    const shareBtn = screen.getByRole("button", { name: "Mở bảng chia sẻ" })
    expect(shareBtn).toBeDefined()

    fireEvent.click(shareBtn)
    expect(shareImage.shareOrDownloadPng).toHaveBeenCalledWith(blob, "phieu.png", "Phiếu tháng 5")
  })
})
