/**
 * @vitest-environment jsdom
 */
import { StrictMode } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

  // Review S I2: StrictMode (dev) chạy effect 2 lần → không được để <img> trỏ vào URL đã thu hồi.
  it("StrictMode: ảnh không trỏ vào URL đã revoke", async () => {
    vi.mocked(shareImage.canShareFiles).mockReturnValue(false)
    let n = 0
    window.URL.createObjectURL = vi.fn(() => `blob:${++n}`)
    render(
      <StrictMode>
        <LanguageProvider forcedLanguage="vi">
          <NoticeImageViewer blob={blob} filename="a.png" title="Phiếu" onClose={() => {}} />
        </LanguageProvider>
      </StrictMode>
    )
    await waitFor(() => expect(screen.getByRole("img").getAttribute("src")).toMatch(/^blob:/))
    const src = screen.getByRole("img").getAttribute("src")
    const revoked = vi.mocked(window.URL.revokeObjectURL).mock.calls.map((c) => c[0])
    expect(revoked).not.toContain(src)
  })

  // Review S C1: DialogContent gốc có left/top 50% + translate -50%; màn toàn màn hình phải tắt cả hai.
  it("màn xem phủ kín từ góc trên trái (không còn translate -50%)", () => {
    vi.mocked(shareImage.canShareFiles).mockReturnValue(false)
    render(
      <LanguageProvider forcedLanguage="vi">
        <NoticeImageViewer blob={blob} filename="a.png" title="Phiếu" onClose={() => {}} />
      </LanguageProvider>
    )
    const cls = screen.getByRole("dialog").className
    expect(cls).toContain("translate-x-0")
    expect(cls).toContain("translate-y-0")
    expect(cls).not.toContain("translate-x-[-50%]")
    expect(cls).not.toContain("top-[50%]")
  })
})
