/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppHeader } from "@/components/layout/AppHeader"
import { RELEASES } from "@/lib/releases"
import viText from "@/language/vi.json"

// jsdom không có ResizeObserver mà Radix dialog cần.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const download = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ release: { status: { setData: vi.fn() } } }),
    release: {
      status: { useQuery: () => ({ data: { lastSeenRelease: RELEASES[0].version } }) },
      markSeen: { useMutation: () => ({ mutate: vi.fn() }) },
    },
    feedback: {
      submit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

let currentSession = { user: { username: "admin_test", fullName: "Quản trị Test" } }

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: currentSession }),
  signOut: vi.fn(),
}))
vi.mock("@/hooks/useBackupDownload", () => ({ useBackupDownload: () => ({ download, isDownloading: false }) }))
vi.mock("@/components/plan/RenewOffer", () => ({ RenewOffer: () => <div data-testid="renew-offer-slot" /> }))
vi.mock("@/components/layout/ChangePasswordDialog", () => ({
  ChangePasswordDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))
vi.mock("@/components/plan/CurrentPlanBadge", () => ({
  CurrentPlanBadge: ({ className }: { className?: string }) => <span data-testid="current-plan-badge" className={className} />,
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
  beforeEach(() => {
    download.mockReset()
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })

  it("mặc định (giáo viên): có RenewOffer; menu Sao lưu dữ liệu, Góp ý, Đổi mật khẩu, Đăng xuất; không có Quản trị", async () => {
    currentSession = { user: { username: "teacher", fullName: "Cô Mai" } }
    renderHeader()
    expect(screen.getByTestId("renew-offer-slot")).toBeTruthy()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Sao lưu dữ liệu", "Góp ý", "Đổi mật khẩu", "Đăng xuất"])
  })

  it("giáo viên mở menu có Góp ý, bấm vào hiện dialog Góp ý cho app", async () => {
    currentSession = { user: { username: "teacher", fullName: "Cô Mai" } }
    renderHeader()
    const feedbackItem = await screen.findByRole("menuitem", { name: "Góp ý" })
    fireEvent.click(feedbackItem)
    expect(await screen.findByRole("heading", { name: "Góp ý cho app" })).toBeTruthy()
  })

  it("bấm Sao lưu dữ liệu → hiện dialog cảnh báo, bấm Tôi hiểu tải xuống mới gọi download", async () => {
    currentSession = { user: { username: "teacher", fullName: "Cô Mai" } }
    renderHeader()
    const backupItem = await screen.findByRole("menuitem", { name: "Sao lưu dữ liệu" })
    fireEvent.click(backupItem)
    expect(download).not.toHaveBeenCalled()

    expect(screen.getByText(viText.backup_confirm_title)).toBeTruthy()
    const confirmBtn = screen.getByRole("button", { name: viText.backup_confirm_download })
    fireEvent.click(confirmBtn)
    expect(download).toHaveBeenCalledTimes(1)
  })

  it("admin: không RenewOffer; menu Quản trị (link /admin/overview), Đổi mật khẩu, Đăng xuất; không Sao lưu, không Góp ý", async () => {
    currentSession = { user: { username: "admin_test", fullName: "Quản trị Test" } }
    renderHeader("admin")
    expect(screen.queryByTestId("renew-offer-slot")).toBeNull()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Quản trị", "Đổi mật khẩu", "Đăng xuất"])
    expect(screen.getByRole("menuitem", { name: "Quản trị" }).getAttribute("href")).toBe("/admin/overview")
    expect(screen.queryByRole("menuitem", { name: "Góp ý" })).toBeNull()
  })

  it("giáo viên: nhãn gói nằm trong nút menu tài khoản, chỉ hiện ở mobile", () => {
    renderHeader()
    const badge = screen.getByRole("button", { name: "Mở menu tài khoản", hidden: true }).querySelector('[data-testid="current-plan-badge"]')
    expect(badge).not.toBeNull()
    expect(badge!.className).toContain("md:hidden")
  })

  it("admin: không có nhãn gói", () => {
    renderHeader("admin")
    expect(screen.queryByTestId("current-plan-badge")).toBeNull()
  })
})
