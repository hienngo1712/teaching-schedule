/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

type U = {
  id: number; username: string; fullName: string | null; createdAt: string; lastLoginAt: string | null
  activeStudents: number; plan: "standard" | "plus" | "pro"; source: "free" | "trial" | "paid"
  expiresAt: string | null; trialEndsAt: string | null; isAdmin: boolean
}
const state = vi.hoisted(() => ({ users: [] as U[] }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      overview: {
        useQuery: () => ({ data: { users: state.users, pendingOrders: [] }, isPending: false, isError: false, refetch: vi.fn() }),
      },
    },
  },
}))
vi.mock("@/components/admin/SetPlanDialog", () => ({ SetPlanDialog: ({ user }: { user: U }) => <div data-testid="set-plan-dialog">{user.username}</div> }))
vi.mock("@/components/admin/TrialDaysDialog", () => ({ TrialDaysDialog: ({ user }: { user: U }) => <div data-testid="trial-dialog">{user.username}</div> }))
vi.mock("@/components/admin/ResetPasswordDialog", () => ({ ResetPasswordDialog: ({ user }: { user: U }) => <div data-testid="reset-dialog">{user.username}</div> }))

import { AdminAccounts } from "@/components/admin/AdminAccounts"

function user(id: number, over: Partial<U> = {}): U {
  return {
    id, username: `gv${id}`, fullName: `Giáo viên ${id}`, createdAt: "2026-09-01T03:00:00.000Z", lastLoginAt: null,
    activeStudents: 3, plan: "standard", source: "free", expiresAt: null, trialEndsAt: null, isAdmin: false, ...over,
  }
}
function renderPage() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminAccounts />
    </LanguageProvider>
  )
}
// Bảng và thẻ đều có trong DOM (jsdom không áp CSS md:) → luôn tìm trong bảng.
const table = () => screen.getByRole("table")
function openMenu(username: string) {
  fireEvent.keyDown(within(table()).getByRole("button", { name: `Menu hành động ${username}` }), { key: "Enter" })
}

beforeEach(() => {
  state.users = [user(1), user(2, { username: "admin_test", isAdmin: true })]
})

describe("AdminAccounts — cột Hành động, cột gọn, phân trang (spec P9)", () => {
  it("có cột Hành động; không còn nút rời Đặt gói/Đặt dùng thử/Reset mật khẩu", () => {
    renderPage()
    expect(within(table()).getByRole("columnheader", { name: "Hành động" })).toBeTruthy()
    for (const name of ["Đặt gói", "Đặt dùng thử", "Reset mật khẩu"]) {
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })

  it("giáo viên: menu đủ 3 mục đúng thứ tự, mỗi mục có icon", async () => {
    renderPage()
    openMenu("gv1")
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Đặt gói", "Đặt dùng thử", "Reset mật khẩu"])
    for (const i of items) {
      expect(i.querySelector("svg")).not.toBeNull()
      expect(i.className).toContain("min-h-11")
    }
  })

  it("tài khoản admin: chỉ Đặt gói", async () => {
    renderPage()
    openMenu("admin_test")
    expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Đặt gói"])
  })

  it.each([
    ["Đặt gói", "set-plan-dialog"],
    ["Đặt dùng thử", "trial-dialog"],
    ["Reset mật khẩu", "reset-dialog"],
  ])("chọn %s → mở đúng dialog cho đúng tài khoản", async (item, testId) => {
    renderPage()
    openMenu("gv1")
    fireEvent.click(await screen.findByRole("menuitem", { name: item }))
    expect((await screen.findByTestId(testId)).textContent).toBe("gv1")
  })

  it("nút Hành động ≥44px mobile; tiêu đề và ô ngày/gói không xuống dòng", () => {
    renderPage()
    expect(within(table()).getByRole("button", { name: "Menu hành động gv1" }).className).toContain("size-11")
    for (const name of ["Tên đăng nhập", "Đăng nhập cuối", "HS đang học", "Gói", "Hành động"]) {
      expect(within(table()).getByRole("columnheader", { name }).className).toContain("whitespace-nowrap")
    }
    expect(within(table()).getAllByText("Standard · Miễn phí", { selector: "td" })[0].className).toContain("whitespace-nowrap")
  })

  it("25 tài khoản → trang 1 có 20 dòng, Trang sau → 5 dòng", () => {
    state.users = Array.from({ length: 25 }, (_, i) => user(i + 1))
    renderPage()
    const rows = () => within(table()).getAllByRole("row").length - 1
    expect(rows()).toBe(20)
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }))
    expect(rows()).toBe(5)
  })
})
