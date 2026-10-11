/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppSidebar } from "@/components/layout/AppSidebar"

// AL: mặc định TK 1 nơi theo học sinh (giao diện như cũ); test "chỉ trung tâm" đổi placeState.summary.
const placeState = vi.hoisted(() => ({
  places: [] as { id: number; name: string; color: string; billing: string }[],
  summary: undefined as { count: number; hasPerStudent: boolean; hasPerSession: boolean } | undefined,
}))
vi.mock("@/hooks/usePlaceSummary", () => ({
  usePlaceSummary: () => ({
    places: placeState.places,
    summary: placeState.summary,
    multi: placeState.places.length >= 2,
    placeById: (id: number | null | undefined) => placeState.places.find((p) => p.id === id),
  }),
}))

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

  it("link HD sử dụng có chữ ẩn báo mở tab mới", () => {
    renderSidebar()
    expect(screen.getByRole("link", { name: /HD sử dụng.*mở tab mới/ })).toBeDefined()
  })
})
