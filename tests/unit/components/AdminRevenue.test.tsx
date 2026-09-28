/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminRevenue } from "@/components/admin/AdminRevenue"
import { buildRevenueReport, type RevenueOrder, type RevenueReport } from "@/lib/revenue"

type Call = { input: { from: { year: number; month: number }; to: { year: number; month: number } }; opts?: { enabled?: boolean } }
const h = vi.hoisted(() => ({ calls: [] as Call[], data: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      revenue: {
        useQuery: (input: Call["input"], opts?: Call["opts"]) => {
          h.calls.push({ input, opts })
          return { data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }
        },
      },
    },
  },
}))

const o = (p: Omit<Partial<RevenueOrder>, "decidedAt"> & { id: number; decidedAt: string }): RevenueOrder => ({
  userId: 1, plan: "plus", period: "month", amount: 49000, creditDays: 0, ...p, decidedAt: new Date(p.decidedAt),
})
const REPORT: RevenueReport = buildRevenueReport(
  [
    o({ id: 1, decidedAt: "2026-03-10T03:00:00Z" }),
    o({ id: 2, decidedAt: "2026-04-15T03:00:00Z", period: "year", amount: 490000 }),
    o({ id: 3, decidedAt: "2026-05-20T03:00:00Z", plan: "pro", period: "year", amount: 990000, creditDays: 120 }),
    o({ id: 4, decidedAt: "2026-06-30T16:30:00Z", plan: "pro", period: "month", amount: 99000 }),
  ],
  { year: 2026, month: 1 },
  { year: 2026, month: 12 }
)

function renderRevenue() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminRevenue />
    </LanguageProvider>
  )
}
const last = () => h.calls[h.calls.length - 1]

beforeEach(() => {
  h.calls = []
  h.data = undefined
  vi.useFakeTimers({ toFake: ["Date"] })
  // 12:00 ngày 15/10/2026 giờ VN.
  vi.setSystemTime(new Date("2026-10-15T05:00:00.000Z"))
})
afterEach(() => {
  vi.useRealTimers()
})

describe("AdminRevenue — bộ lọc (spec K 8.3)", () => {
  it("mặc định: Năm hiện tại giờ VN → T1..T12/2026, query bật", () => {
    renderRevenue()
    expect(screen.getByRole("radio", { name: "Năm" }).getAttribute("aria-checked")).toBe("true")
    expect(last().input).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 12 } })
    expect(last().opts?.enabled).toBe(true)
  })
  it("bấm Tháng → tháng hiện tại; bấm Khoảng → T1 đến tháng hiện tại", () => {
    renderRevenue()
    fireEvent.click(screen.getByRole("radio", { name: "Tháng" }))
    expect(last().input).toEqual({ from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } })
    fireEvent.click(screen.getByRole("radio", { name: "Khoảng" }))
    expect(last().input).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 10 } })
  })
  it("nút chế độ cao ≥44px trên mobile (class h-11)", () => {
    renderRevenue()
    for (const name of ["Tháng", "Khoảng", "Năm"]) expect(screen.getByRole("radio", { name }).className).toContain("h-11")
  })
})

describe("AdminRevenue — số liệu", () => {
  it("tổng, 3 nhóm loại đơn, theo gói, theo kỳ", () => {
    h.data = REPORT
    renderRevenue()
    const s = screen.getByTestId("revenue-summary")
    expect(within(s).getByTestId("revenue-total").textContent).toContain("1.628.000 đ")
    expect(within(s).getByTestId("revenue-total").textContent).toContain("4 đơn")
    expect(within(s).getByTestId("revenue-kind-new").textContent).toContain("49.000 đ")
    expect(within(s).getByTestId("revenue-kind-renew").textContent).toContain("589.000 đ")
    expect(within(s).getByTestId("revenue-kind-upgrade").textContent).toContain("990.000 đ")
    expect(within(s).getByTestId("revenue-plan-plus").textContent).toContain("539.000 đ")
    expect(within(s).getByTestId("revenue-plan-pro").textContent).toContain("1.089.000 đ")
    expect(within(s).getByTestId("revenue-period-year").textContent).toContain("1.480.000 đ")
    expect(within(s).getByTestId("revenue-period-2year").textContent).toContain("0 đ")
  })
  it("bảng từng tháng: đủ 12 thẻ, thẻ tháng 6 có tổng 99.000", () => {
    h.data = REPORT
    renderRevenue()
    const cards = screen.getAllByTestId("revenue-month-card")
    expect(cards).toHaveLength(12)
    expect(cards[5].textContent).toContain("Tháng 6/2026")
    expect(cards[5].textContent).toContain("99.000 đ")
  })
  it("chế độ Năm có biểu đồ 12 cột (aria-label tiền VN); chế độ Tháng (1 tháng) không có biểu đồ", () => {
    h.data = REPORT
    renderRevenue()
    const chart = screen.getByTestId("revenue-chart")
    expect(within(chart).getAllByTestId("chart-bar")).toHaveLength(12)
    expect(within(chart).getByRole("img", { name: "Tháng 5/2026: 990.000 đ" })).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "Tháng" }))
    expect(screen.queryByTestId("revenue-chart")).toBeNull()
  })
})
