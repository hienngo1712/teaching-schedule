/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PrivacyContent } from "@/components/privacy/PrivacyContent"

describe("PrivacyContent (spec X §3.2)", () => {
  it("có khung tóm tắt, vẫn đúng 5 mục h2, không có link Đọc đầy đủ", () => {
    render(<LanguageProvider forcedLanguage="vi"><PrivacyContent /></LanguageProvider>)
    expect(screen.getByText(viText.privacy_summary_title_page)).toBeTruthy()
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5)
    expect(screen.queryByRole("link", { name: new RegExp(viText.privacy_read_full) })).toBeNull()
  })
})
