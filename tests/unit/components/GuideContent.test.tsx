/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideContent } from "@/components/guide/GuideContent"
import { GUIDE_SECTIONS, GUIDE_SHOTS, GUIDE_DOCX_FILENAME, GUIDE_DOCX_PATH } from "@/lib/guide-content"

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
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <GuideContent />
      </LanguageProvider>
    )
    expect(screen.getByRole("heading", { level: 1, name: viText.guide_title })).toBeTruthy()
    const toc = screen.getByRole("navigation", { name: viText.guide_toc })
    expect(toc.querySelectorAll("a").length).toBe(GUIDE_SECTIONS.length)
    for (const s of GUIDE_SECTIONS) {
      expect(container.querySelector(`section#${s.id}`)).not.toBeNull()
      expect(toc.querySelector(`a[href="#${s.id}"]`)).not.toBeNull()
    }
    const downloadLink = screen.getByRole("link", { name: viText.guide_download_docx })
    expect(downloadLink.className).toContain("print:hidden")
    expect(toc.className).toContain("print:hidden")
  })

  it("link Tải Word trỏ thẳng file tĩnh huong-dan-su-dung.docx", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <GuideContent />
      </LanguageProvider>
    )
    const downloadLink = screen.getByRole("link", { name: viText.guide_download_docx })
    expect(downloadLink.getAttribute("href")).toBe(GUIDE_DOCX_PATH)
    expect(downloadLink.getAttribute("download")).toBe(GUIDE_DOCX_FILENAME)
  })

  it("số khung ảnh trên trang bằng GUIDE_SHOTS.length", () => {
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <GuideContent />
      </LanguageProvider>
    )
    const shots = container.querySelectorAll('[data-testid="guide-shot"]')
    expect(shots.length).toBe(GUIDE_SHOTS.length)
  })

  it("canTour: 6 mục có nút Chỉ cho tôi; mặc định không có", () => {
    const { unmount } = render(<LanguageProvider forcedLanguage="vi"><GuideContent canTour /></LanguageProvider>)
    const hrefs = screen.getAllByRole("link", { name: "Chỉ cho tôi" }).map((a) => a.getAttribute("href"))
    expect(hrefs).toEqual([
      "/students?tour=student",
      "/students?tour=import",
      "/calendar?tour=session",
      "/calendar?tour=attendance",
      "/tuition?tour=tuition",
      "/settings?tour=bank",
    ])
    unmount()
    render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
    expect(screen.queryByRole("link", { name: "Chỉ cho tôi" })).toBeNull()
  })
})
