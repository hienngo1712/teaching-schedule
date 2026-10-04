/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { UpdatesContent } from "@/components/whats-new/UpdatesContent"
import { RELEASES } from "@/lib/releases"

describe("UpdatesContent (spec W §5.5)", () => {
  it("mỗi bản 1 khối id=v<version>, đủ mục, link hướng dẫn cho mục có guideId, nút Tải PDF", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><UpdatesContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { level: 1, name: viText.updates_title })).toBeTruthy()
    for (const r of RELEASES) {
      const block = container.querySelector(`[id="v${r.version}"]`)
      expect(block, r.version).not.toBeNull()
      expect(block!.querySelectorAll("li").length).toBe(r.items.length)
    }
    const guided = RELEASES.flatMap((r) => r.items).filter((i) => i.guideId).length
    expect(screen.getAllByRole("link", { name: viText.updates_guide_link })).toHaveLength(guided)
    expect(screen.getByRole("button", { name: viText.print_pdf })).toBeTruthy()
  })
})
