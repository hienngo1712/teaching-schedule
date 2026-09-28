/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminTabBar } from "@/components/admin/AdminTabBar"

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))
const pending = vi.hoisted(() => ({ data: undefined as undefined | { count: number } }))
vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { pendingCount: { useQuery: () => ({ data: pending.data }) } } },
}))

beforeEach(() => {
  pending.data = undefined
})

function renderVi(ui: React.ReactNode) {
  return render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)
}

describe("AdminSidebar", () => {
  it("logo Lịch dạy + nhãn Quản trị; đúng 5 mục admin, mục đang mở aria-current; số đơn chờ; không có mục giáo viên", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/history")
    pending.data = { count: 2 }
    renderVi(<AdminSidebar />)
    expect(screen.getByText("Lịch dạy")).toBeTruthy()
    expect(screen.getByText("Quản trị")).toBeTruthy()
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/admin/overview",
      "/admin/orders",
      "/admin/accounts",
      "/admin/history",
      "/admin/prices",
    ])
    expect(screen.getByRole("link", { name: "Lịch sử đơn" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: /Tài khoản & gói/ }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByRole("link", { name: "Bảng giá" }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByTestId("admin-pending-count").textContent).toBe("2")
    expect(screen.queryByText("Học sinh")).toBeNull()
    expect(screen.queryByText("Học phí")).toBeNull()
  })

  it("0 đơn chờ hoặc chưa tải → không hiện số", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/orders")
    renderVi(<AdminSidebar />)
    expect(screen.queryByTestId("admin-pending-count")).toBeNull()
  })
})

describe("AdminTabBar", () => {
  it("5 tab nhãn ngắn, tab đang mở aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/accounts")
    renderVi(<AdminTabBar />)
    const links = screen.getAllByRole("link")
    expect(links.map((l) => [l.getAttribute("href"), l.textContent])).toEqual([
      ["/admin/overview", "Tổng quan"],
      ["/admin/orders", "Đơn chờ"],
      ["/admin/accounts", "Tài khoản"],
      ["/admin/history", "Lịch sử"],
      ["/admin/prices", "Bảng giá"],
    ])
    expect(screen.getByRole("link", { name: "Tài khoản" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).className).toContain("md:hidden")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).querySelector("ul")?.className).toContain("grid-cols-5")
  })

  it("tab Đơn chờ có số đơn chờ ở góc icon; 0 đơn → không có", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/history")
    pending.data = { count: 3 }
    const { unmount } = renderVi(<AdminTabBar />)
    const badge = screen.getByTestId("admin-tab-pending-count")
    expect(badge.textContent).toBe("3")
    expect(badge.className).toContain("bg-amber-100")
    expect(screen.getByRole("link", { name: /Đơn chờ/ }).contains(badge)).toBe(true)
    unmount()
    pending.data = { count: 0 }
    renderVi(<AdminTabBar />)
    expect(screen.queryByTestId("admin-tab-pending-count")).toBeNull()
  })
})
