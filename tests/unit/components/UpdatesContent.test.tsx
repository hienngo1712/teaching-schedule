/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { UpdatesContent } from "@/components/whats-new/UpdatesContent"
import { RELEASES } from "@/lib/releases"

vi.mock("@/lib/guide-docx", () => ({
  UPDATES_DOCX_FILENAME: "cac-ban-cap-nhat.docx",
  buildUpdatesDocx: vi.fn(async () => new Blob(["x"])),
}))
// Đúng hình dạng webpack trả cho import() động của file-saver (CJS): chỉ có default.
const { fileSaver } = vi.hoisted(() => ({ fileSaver: vi.fn() }))
vi.mock("file-saver", () => ({ default: fileSaver }))

describe("UpdatesContent (spec W §5.5)", () => {
  it("mỗi bản 1 khối id=v<version>, đủ mục, link hướng dẫn cho mục có guideId, nút Tải Word", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><UpdatesContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { level: 1, name: viText.updates_title })).toBeTruthy()
    for (const r of RELEASES) {
      const block = container.querySelector(`[id="v${r.version}"]`)
      expect(block, r.version).not.toBeNull()
      expect(block!.querySelectorAll("li").length).toBe(r.items.length)
    }
    const guided = RELEASES.flatMap((r) => r.items).filter((i) => i.guideId).length
    expect(screen.getAllByRole("link", { name: viText.updates_guide_link })).toHaveLength(guided)
    expect(screen.getByRole("button", { name: viText.guide_download_docx })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /PDF/ })).toBeNull()
  })

  it("bấm Tải Word → lưu cac-ban-cap-nhat.docx", async () => {
    render(<LanguageProvider forcedLanguage="vi"><UpdatesContent /></LanguageProvider>)
    fireEvent.click(screen.getByRole("button", { name: viText.guide_download_docx }))
    await waitFor(() => expect(fileSaver).toHaveBeenCalledWith(expect.any(Blob), "cac-ban-cap-nhat.docx"))
  })
})
