/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PRIVACY_CONTACT } from "@/lib/privacy"
import { PrivacySummary } from "@/components/privacy/PrivacySummary"

function renderVi(ui: React.ReactElement) {
  return render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)
}

describe("PrivacySummary (spec X §3)", () => {
  it("hiện tiêu đề + 4 ý, thay {contact}, không dùng heading", () => {
    const { container } = renderVi(<PrivacySummary />)
    expect(screen.getByText(viText.privacy_summary_title)).toBeTruthy()
    for (const lead of [
      viText.privacy_summary_store_lead,
      viText.privacy_summary_protect_lead,
      viText.privacy_summary_who_lead,
      viText.privacy_summary_delete_lead,
    ]) {
      expect(screen.getByText(lead)).toBeTruthy()
    }
    expect(container.textContent).toContain(PRIVACY_CONTACT)
    expect(container.textContent).not.toContain("{contact}")
    expect(container.querySelector("h1,h2,h3")).toBeNull()
  })

  it("mặc định không có link Đọc đầy đủ", () => {
    renderVi(<PrivacySummary />)
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("showFullLink: link /privacy mở tab mới, rel noopener, cao ≥ 44px", () => {
    renderVi(<PrivacySummary showFullLink />)
    const link = screen.getByRole("link", { name: new RegExp(viText.privacy_read_full) })
    expect(link.getAttribute("href")).toBe("/privacy")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(link.className).toContain("min-h-11")
  })
})
