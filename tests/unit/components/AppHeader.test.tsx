/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppHeader } from "@/components/layout/AppHeader"

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { username: "admin_test", fullName: "Quản trị Test" } } }),
  signOut: vi.fn(),
}))
vi.mock("@/hooks/useBackupDownload", () => ({ useBackupDownload: () => ({ download: vi.fn(), isDownloading: false }) }))
vi.mock("@/components/plan/RenewOffer", () => ({ RenewOffer: () => <div data-testid="renew-offer-slot" /> }))
vi.mock("@/components/layout/ChangePasswordDialog", () => ({
  ChangePasswordDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))

function renderHeader(variant?: "teacher" | "admin") {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AppHeader variant={variant} />
    </LanguageProvider>
  )
  // Radix DropdownMenu mở bằng phím Enter trên trigger (jsdom không có PointerEvent đầy đủ).
  fireEvent.keyDown(screen.getByRole("button", { name: "Mở menu tài khoản" }), { key: "Enter" })
}

describe("AppHeader", () => {
  it("mặc định (giáo viên): có RenewOffer; menu Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất; không có Quản trị", async () => {
    renderHeader()
    expect(screen.getByTestId("renew-offer-slot")).toBeTruthy()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Sao lưu dữ liệu", "Đổi mật khẩu", "Đăng xuất"])
  })

  it("admin: không RenewOffer; menu Quản trị (link /admin/orders), Đổi mật khẩu, Đăng xuất; không Sao lưu", async () => {
    renderHeader("admin")
    expect(screen.queryByTestId("renew-offer-slot")).toBeNull()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Quản trị", "Đổi mật khẩu", "Đăng xuất"])
    expect(screen.getByRole("menuitem", { name: "Quản trị" }).getAttribute("href")).toBe("/admin/orders")
  })
})
