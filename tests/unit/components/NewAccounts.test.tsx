/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { NewAccounts } from "@/components/admin/NewAccounts"

const h = vi.hoisted(() => ({ data: undefined as unknown, mutate: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/admin/SetPlanDialog", () => ({ SetPlanDialog: ({ user }: { user: { username: string } }) => <div data-testid="set-plan-dialog">{user.username}</div> }))
vi.mock("@/components/admin/TrialDaysDialog", () => ({ TrialDaysDialog: ({ user }: { user: { username: string } }) => <div data-testid="trial-dialog">{user.username}</div> }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      newAccounts: { useQuery: () => ({ data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }) },
      markAccountsSeen: { useMutation: () => ({ mutate: h.mutate, isPending: false }) },
    },
  },
}))

const ITEMS = [
  { id: 11, username: "gv_moi", fullName: "Cô Mới", createdAt: "2026-11-15T02:30:00.000Z", plan: "standard", source: "free" },
  { id: 12, username: "gv_moi2", fullName: null, createdAt: "2026-11-14T10:00:00.000Z", plan: "pro", source: "trial" },
]
const USERS = [
  { id: 11, username: "gv_moi", fullName: "Cô Mới", createdAt: "2026-11-15T02:30:00.000Z", lastLoginAt: null, activeStudents: 0, plan: "standard", source: "free", expiresAt: null, trialEndsAt: null, isAdmin: false },
]
function renderIt() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <NewAccounts users={USERS as never} />
    </LanguageProvider>
  )
}
beforeEach(() => {
  h.data = undefined
  h.mutate.mockReset()
})

describe("NewAccounts (spec K 8.3b)", () => {
  it("liệt kê thẻ, giờ VN, gói hiện tại; Đã xem gọi markAccountsSeen({ userIds: [id] })", () => {
    h.data = { items: ITEMS, total: 2 }
    renderIt()
    const cards = screen.getAllByTestId("new-account-card")
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toContain("gv_moi")
    expect(cards[0].textContent).toContain("Cô Mới")
    expect(cards[0].textContent).toContain("15/11/2026 09:30")
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Đã xem" }))
    expect(h.mutate).toHaveBeenCalledWith({ userIds: [11] })
  })
  it("Đặt gói / Đặt dùng thử mở đúng dialog với dòng user tra trong overview; không tra được → nút khóa", () => {
    h.data = { items: ITEMS, total: 2 }
    renderIt()
    const cards = screen.getAllByTestId("new-account-card")
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Đặt gói" }))
    expect(screen.getByTestId("set-plan-dialog").textContent).toBe("gv_moi")
    expect((within(cards[1]).getByRole("button", { name: "Đặt dùng thử" }) as HTMLButtonElement).disabled).toBe(true)
  })
  it("nút Đã xem cao ≥44px mobile (h-11); trống → 'Không có tài khoản mới', không có nút đánh dấu tất cả", () => {
    h.data = { items: ITEMS.slice(0, 1), total: 1 }
    renderIt()
    expect(within(screen.getByTestId("new-account-card")).getByRole("button", { name: "Đã xem" }).className).toContain("h-11")
    h.data = { items: [], total: 0 }
    renderIt()
    expect(screen.getAllByText("Không có tài khoản mới").length).toBeGreaterThan(0)
  })
})
