/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppSidebar } from "@/components/layout/AppSidebar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ ready: true, has: () => true }),
}))

vi.mock("@/components/plan/CurrentPlanBadge", () => ({
  CurrentPlanBadge: () => <span data-testid="current-plan-badge" />,
}))

function renderSidebar() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <AppSidebar />
    </LanguageProvider>
  )
}

describe("AppSidebar — mục HD sử dụng", () => {
  it("sidebar có link HD sử dụng tới /guide, mở tab mới", () => {
    renderSidebar()
    const link = screen.getByRole("link", { name: /HD sử dụng/ })
    expect(link.getAttribute("href")).toBe("/guide")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
  })
})
