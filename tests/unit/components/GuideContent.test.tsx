/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideContent } from "@/components/guide/GuideContent"
import { GUIDE_SECTIONS, GUIDE_SHOTS } from "@/lib/guide-content"

vi.mock("@/lib/guide-docx", () => ({
  GUIDE_DOCX_FILENAME: "huong-dan-su-dung.docx",
  buildGuideDocx: vi.fn(async () => new Blob(["x"])),
}))
// Đúng hình dạng webpack trả cho import() động của file-saver (CJS): chỉ có default, không có saveAs.
const { fileSaver } = vi.hoisted(() => ({ fileSaver: vi.fn() }))
vi.mock("file-saver", () => ({ default: fileSaver }))

describe("GuideContent (spec W §3.2 & Task 9)", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })

  it("h1, mục lục link tới từng anchor, mỗi mục 1 section có id, nút Tải Word ẩn khi in", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { level: 1, name: viText.guide_title })).toBeTruthy()
    const toc = screen.getByRole("navigation", { name: viText.guide_toc })
    expect(toc.querySelectorAll("a").length).toBe(GUIDE_SECTIONS.length)
    for (const s of GUIDE_SECTIONS) {
      expect(container.querySelector(`section#${s.id}`)).not.toBeNull()
      expect(toc.querySelector(`a[href="#${s.id}"]`)).not.toBeNull()
    }
    const downloadBtn = screen.getByRole("button", { name: viText.guide_download_docx })
    expect(downloadBtn.className).toContain("print:hidden")
    expect(toc.className).toContain("print:hidden")
  })

  it("bấm Tải Word → tạo file từ GUIDE_SECTIONS và lưu huong-dan-su-dung.docx", async () => {
    render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
    fireEvent.click(screen.getByRole("button", { name: viText.guide_download_docx }))
    await waitFor(() => expect(fileSaver).toHaveBeenCalledWith(expect.any(Blob), "huong-dan-su-dung.docx"))
  })

  it("số khung ảnh trên trang bằng GUIDE_SHOTS.length", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
    const shots = container.querySelectorAll('[data-testid="guide-shot"]')
    expect(shots.length).toBe(GUIDE_SHOTS.length)
  })
})
