/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminTabBar } from "@/components/admin/AdminTabBar"

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))
const pending = vi.hoisted(() => ({ data: undefined as undefined | { count: number; newAccounts?: number } }))
const chat = vi.hoisted(() => ({ data: undefined as undefined | { conversations: number } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      pendingCount: { useQuery: () => ({ data: pending.data }) },
      chatUnread: { useQuery: () => ({ data: chat.data }) },
    },
  },
}))

beforeEach(() => {
  pending.data = undefined
  chat.data = undefined
})

function renderVi(ui: React.ReactNode) {
  return render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)
}

describe("AdminSidebar", () => {
  it("logo Lịch dạy + nhãn Quản trị; đúng 8 mục admin, mục đang mở aria-current; số đơn chờ; không có mục giáo viên", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/history")
    pending.data = { count: 2 }
    renderVi(<AdminSidebar />)
    expect(screen.getByText("Lịch dạy")).toBeTruthy()
    expect(screen.getByText("Quản trị")).toBeTruthy()
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/admin/overview",
      "/admin/orders",
      "/admin/chat",
      "/admin/accounts",
      "/admin/history",
      "/admin/prices",
      "/admin/revenue",
      "/admin/feedback",
    ])
    expect(screen.getByRole("link", { name: "Lịch sử đơn" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: /Tài khoản & gói/ }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByRole("link", { name: "Bảng giá" }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByTestId("admin-pending-count").textContent).toBe("2")
    expect(screen.queryByText("Học sinh")).toBeNull()
    expect(screen.queryByText("Học phí")).toBeNull()
  })

  it("badge chat chưa đọc ở sidebar và tab bar", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/overview")
    chat.data = { conversations: 2 }
    renderVi(<AdminSidebar />)
    expect(screen.getByTestId("admin-chat-unread").textContent).toBe("2")
    expect(screen.getByTestId("admin-chat-unread").getAttribute("aria-label")).toBe("2 cuộc trò chuyện chưa đọc")
    cleanup()
    renderVi(<AdminTabBar />)
    expect(screen.getByTestId("admin-chat-unread").textContent).toBe("2")
  })

  it("0 đơn chờ hoặc chưa tải → không hiện số", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/orders")
    renderVi(<AdminSidebar />)
    expect(screen.queryByTestId("admin-pending-count")).toBeNull()
  })
})

describe("AdminTabBar", () => {
  it("8 tab nhãn ngắn, tab đang mở aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/accounts")
    renderVi(<AdminTabBar />)
    const links = screen.getAllByRole("link")
    expect(links.map((l) => [l.getAttribute("href"), l.textContent])).toEqual([
      ["/admin/overview", "Tổng quan"],
      ["/admin/orders", "Đơn chờ"],
      ["/admin/chat", "Nhắn"],
      ["/admin/accounts", "Tài khoản"],
      ["/admin/history", "Lịch sử"],
      ["/admin/prices", "Bảng giá"],
      ["/admin/revenue", "Doanh thu"],
      ["/admin/feedback", "Góp ý"],
    ])
    expect(screen.getByRole("link", { name: "Tài khoản" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).className).toContain("md:hidden")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).querySelector("ul")?.className).toContain("grid-cols-8")
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

  it("có tài khoản mới: sidebar thêm pill số riêng, tab bar thêm chấm; 0 thì không có", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/orders")
    pending.data = { count: 2, newAccounts: 3 }
    renderVi(<AdminSidebar />)
    expect(screen.getByTestId("admin-new-accounts-count").textContent).toBe("3")
    expect(screen.getByTestId("admin-new-accounts-count").getAttribute("aria-label")).toBe("3 tài khoản mới chưa xem")
    cleanup()
    renderVi(<AdminTabBar />)
    expect(screen.getByTestId("admin-tab-new-dot")).toBeTruthy()
    expect(screen.getByTestId("admin-tab-pending-count").textContent).toBe("2")
    cleanup()
    pending.data = { count: 0, newAccounts: 0 }
    renderVi(<AdminSidebar />)
    expect(screen.queryByTestId("admin-new-accounts-count")).toBeNull()
    cleanup()
    renderVi(<AdminTabBar />)
    expect(screen.queryByTestId("admin-tab-new-dot")).toBeNull()
  })
})

