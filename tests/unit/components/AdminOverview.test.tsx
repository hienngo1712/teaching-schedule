/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminOverview } from "@/components/admin/AdminOverview"

const h = vi.hoisted(() => ({ stats: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      stats: { useQuery: () => ({ data: h.stats, isPending: h.stats === undefined, isError: false, refetch: vi.fn() }) },
      accountTrend: { useQuery: () => ({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }) },
    },
  },
}))

const STATS = {
  totalAccounts: 42, activeAccounts: 40, active24h: 7, active7d: 15,
  paying: { plus: 5, pro: 3 }, trial: 9, expiringSoon: { paid: 2, trial: 1 }, standardAfterTrial: 6,
  pendingOrders: 2, newAccounts: 3, updatedAt: "2026-11-15T05:07:00.000Z",
}
function renderOverview() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminOverview />
    </LanguageProvider>
  )
}
beforeEach(() => {
  h.stats = undefined
})

describe("AdminOverview (spec K 8.2)", () => {
  it("9 thẻ đúng số và dòng phụ; cập nhật lúc giờ VN", () => {
    h.stats = STATS
    renderOverview()
    const text = (id: string) => screen.getByTestId(`card-${id}`).textContent ?? ""
    expect(text("total")).toContain("42")
    expect(text("active")).toContain("40")
    expect(text("active24h")).toContain("7")
    expect(text("active7d")).toContain("15")
    expect(text("paying")).toContain("8")
    expect(text("paying")).toContain("Plus 5 · Pro 3")
    expect(text("trial")).toContain("9")
    expect(text("expiring")).toContain("3")
    expect(text("expiring")).toContain("2 trả phí · 1 dùng thử")
    expect(text("std-after-trial")).toContain("6")
    expect(screen.getByText("Cập nhật lúc 15/11 12:07")).toBeTruthy()
  })
  it("Chờ duyệt > 0: là link tới /admin/orders, viền amber", () => {
    h.stats = STATS
    renderOverview()
    const card = screen.getByTestId("card-pending")
    expect(card.closest("a")?.getAttribute("href")).toBe("/admin/orders")
    expect(card.className).toContain("border-t-amber-500")
    expect(card.textContent).toContain("3 tài khoản mới chưa xem")
  })
  it("Chờ duyệt = 0: viền slate, dòng 'Không có đơn chờ'; 0 tài khoản mới thì không có dòng tài khoản mới", () => {
    h.stats = { ...STATS, pendingOrders: 0, newAccounts: 0, expiringSoon: { paid: 0, trial: 0 } }
    renderOverview()
    const card = screen.getByTestId("card-pending")
    expect(card.className).toContain("border-t-slate-300")
    expect(card.textContent).toContain("Không có đơn chờ")
    expect(card.textContent).not.toContain("tài khoản mới")
    expect(screen.getByTestId("card-expiring").className).toContain("border-t-slate-300")
  })
})
