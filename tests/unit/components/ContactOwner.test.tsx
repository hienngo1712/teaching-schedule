/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ContactOwner } from "@/components/common/ContactOwner"

const h = vi.hoisted(() => ({ data: null as null | { phone: string; facebookUrl: string | null } }))
vi.mock("@/lib/trpc", () => ({
  trpc: { contact: { get: { useQuery: () => ({ data: h.data }) } } },
}))
const mockContact = (d: typeof h.data) => {
  h.data = d
}
const ui = () => (
  <LanguageProvider forcedLanguage="vi">
    <ContactOwner />
  </LanguageProvider>
)

describe("ContactOwner", () => {
  it("có liên hệ: 3 nút đúng href, hiện số điện thoại dạng chữ, link ngoài mở tab mới", () => {
    mockContact({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })
    render(ui())
    expect(screen.getByRole("link", { name: /Gọi/ })).toHaveAttribute("href", "tel:0979479550")
    const zalo = screen.getByRole("link", { name: /Zalo/ })
    expect(zalo).toHaveAttribute("href", "https://zalo.me/0979479550")
    expect(zalo).toHaveAttribute("target", "_blank")
    expect(zalo).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.getByRole("link", { name: /Facebook/ })).toHaveAttribute("href", "https://www.facebook.com/ngo.quang.hien.657661")
    expect(screen.getByText("0979 479 550")).toBeInTheDocument()
  })
  it("không có Facebook → ẩn nút Facebook; chưa cài → không render gì", () => {
    mockContact({ phone: "0979479550", facebookUrl: null })
    const { container, rerender } = render(ui())
    expect(screen.queryByRole("link", { name: /Facebook/ })).toBeNull()
    mockContact(null)
    rerender(ui())
    expect(container).toBeEmptyDOMElement()
  })
})
