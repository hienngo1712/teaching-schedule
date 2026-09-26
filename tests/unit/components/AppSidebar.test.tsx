/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { UpgradeDialog } from "@/components/plan/UpgradeDialog"

vi.mock("next/navigation", () => ({ usePathname: () => "/subjects" }))
const mockPlan = vi.hoisted(() => ({ allow: true }))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: undefined, ready: true, fields: null, has: () => mockPlan.allow }),
}))

beforeEach(() => {
  mockPlan.allow = true
})

describe("AppSidebar", () => {
  it("5 mục chính + nhóm Quản lý (Môn học, Cài đặt, Gói của tôi); mục đang mở có aria-current", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <AppSidebar />
      </LanguageProvider>
    )
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/calendar",
      "/students",
      "/tuition",
      "/reports",
      "/subjects",
      "/settings",
      "/plan",
    ])
    expect(screen.getByText("Quản lý")).toBeTruthy()
    const subjects = screen.getByRole("link", { name: "Môn học" })
    expect(subjects.getAttribute("aria-current")).toBe("page")
    expect(subjects.className).toContain("text-primary")
    expect(screen.getByRole("link", { name: "Tổng quan" }).getAttribute("aria-current")).toBeNull()
  })

  it("gói Standard: Báo cáo vẫn hiện, có ổ khóa + nhãn Plus; bấm mở popup nâng cấp, không phải link", async () => {
    mockPlan.allow = false
    render(
      <LanguageProvider forcedLanguage="vi">
        <AppSidebar />
        <UpgradeDialog />
      </LanguageProvider>
    )
    expect(screen.queryByRole("link", { name: /Báo cáo/ })).toBeNull()
    const reports = screen.getByRole("button", { name: /Báo cáo/ })
    expect(reports.textContent).toContain("Plus")
    fireEvent.click(reports)
    expect(await screen.findByText("Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.")).toBeTruthy()
  })
})
