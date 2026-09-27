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
const overview = vi.hoisted(() => ({ data: undefined as undefined | { pendingOrders: { id: number }[]; users: never[] } }))
vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { overview: { useQuery: () => ({ data: overview.data }) } } },
}))

beforeEach(() => {
  overview.data = undefined
})

function renderVi(ui: React.ReactNode) {
  return render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)
}

describe("AdminSidebar", () => {
  it("logo Lịch dạy + nhãn Quản trị; đúng 4 mục admin, mục đang mở aria-current; số đơn chờ; không có mục giáo viên", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/history")
    overview.data = { pendingOrders: [{ id: 1 }, { id: 2 }], users: [] }
    renderVi(<AdminSidebar />)
    expect(screen.getByText("Lịch dạy")).toBeTruthy()
    expect(screen.getByText("Quản trị")).toBeTruthy()
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/admin/orders",
      "/admin/accounts",
      "/admin/history",
      "/admin/prices",
    ])
    expect(screen.getByRole("link", { name: "Lịch sử đơn" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: /Tài khoản & gói/ }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByRole("link", { name: "Bảng giá" }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByTestId("admin-pending-count").textContent).toBe("2")
    expect(screen.queryByText("Tổng quan")).toBeNull()
    expect(screen.queryByText("Học phí")).toBeNull()
  })

  it("0 đơn chờ hoặc chưa tải → không hiện số", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/orders")
    renderVi(<AdminSidebar />)
    expect(screen.queryByTestId("admin-pending-count")).toBeNull()
  })
})

describe("AdminTabBar", () => {
  it("4 tab nhãn ngắn, tab đang mở aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/accounts")
    renderVi(<AdminTabBar />)
    const links = screen.getAllByRole("link")
    expect(links.map((l) => [l.getAttribute("href"), l.textContent])).toEqual([
      ["/admin/orders", "Đơn chờ"],
      ["/admin/accounts", "Tài khoản"],
      ["/admin/history", "Lịch sử"],
      ["/admin/prices", "Bảng giá"],
    ])
    expect(screen.getByRole("link", { name: "Tài khoản" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).className).toContain("md:hidden")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).querySelector("ul")?.className).toContain("grid-cols-4")
  })
})
