/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CurrentPlanBadge } from "@/components/plan/CurrentPlanBadge"

const mockPlan = vi.hoisted(() => ({ me: undefined as undefined | { plan: string; source: string } }))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: mockPlan.me, ready: mockPlan.me !== undefined, fields: null, has: () => true }),
}))

beforeEach(() => {
  mockPlan.me = undefined
})

function renderBadge() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <CurrentPlanBadge />
    </LanguageProvider>
  )
  return screen.queryByTestId("current-plan-badge")
}

describe("CurrentPlanBadge", () => {
  it("chưa tải gói → không render", () => {
    expect(renderBadge()).toBeNull()
  })

  it("Standard: viền + chữ slate, không aria-label", () => {
    mockPlan.me = { plan: "standard", source: "free" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Standard")
    expect(badge.className).toContain("border-slate-300")
    expect(badge.className).toContain("text-slate-600")
    expect(badge.getAttribute("aria-label")).toBeNull()
  })

  it("Plus: viền + chữ primary nền trắng", () => {
    mockPlan.me = { plan: "plus", source: "paid" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Plus")
    expect(badge.className).toContain("border-primary")
    expect(badge.className).toContain("bg-white")
    expect(badge.className).toContain("text-primary")
  })

  it("Pro trả phí: nền primary chữ trắng, không icon", () => {
    mockPlan.me = { plan: "pro", source: "paid" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Pro")
    expect(badge.className).toContain("bg-primary")
    expect(badge.className).toContain("text-primary-foreground")
    expect(badge.querySelector("svg")).toBeNull()
  })

  it("Pro dùng thử: icon đồng hồ + aria-label/title Pro dùng thử", () => {
    mockPlan.me = { plan: "pro", source: "trial" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Pro")
    expect(badge.querySelector("svg")).not.toBeNull()
    expect(badge.getAttribute("aria-label")).toBe("Pro dùng thử")
    expect(badge.getAttribute("title")).toBe("Pro dùng thử")
  })
})
