/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideContent } from "@/components/guide/GuideContent"
import { GUIDE_SECTIONS } from "@/lib/guide-content"

describe("GuideContent (spec W §3.2)", () => {
  it("h1, mục lục link tới từng anchor, mỗi mục 1 section có id, nút Tải PDF ẩn khi in", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { level: 1, name: viText.guide_title })).toBeTruthy()
    const toc = screen.getByRole("navigation", { name: viText.guide_toc })
    expect(toc.querySelectorAll("a").length).toBe(GUIDE_SECTIONS.length)
    for (const s of GUIDE_SECTIONS) {
      expect(container.querySelector(`section#${s.id}`)).not.toBeNull()
      expect(toc.querySelector(`a[href="#${s.id}"]`)).not.toBeNull()
    }
    const print = screen.getByRole("button", { name: viText.print_pdf })
    expect(print.className).toContain("print:hidden")
    expect(toc.className).toContain("print:hidden")
  })
})
