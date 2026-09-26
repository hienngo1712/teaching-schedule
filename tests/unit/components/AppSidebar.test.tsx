/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppSidebar } from "@/components/layout/AppSidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/subjects" }))

describe("AppSidebar", () => {
  it("5 mục chính + nhóm Quản lý (Môn học, Cài đặt); mục đang mở có aria-current", () => {
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
    ])
    expect(screen.getByText("Quản lý")).toBeTruthy()
    const subjects = screen.getByRole("link", { name: "Môn học" })
    expect(subjects.getAttribute("aria-current")).toBe("page")
    expect(subjects.className).toContain("text-primary")
    expect(screen.getByRole("link", { name: "Tổng quan" }).getAttribute("aria-current")).toBeNull()
  })
})
