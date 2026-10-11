/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import DashboardPage from "@/app/(app)/dashboard/page"

// AL: mặc định TK 1 nơi theo học sinh (giao diện như cũ); test "chỉ trung tâm" đổi placeState.summary.
const placeState = vi.hoisted(() => ({
  places: [] as { id: number; name: string; color: string; billing: string }[],
  summary: undefined as { count: number; hasPerStudent: boolean; hasPerSession: boolean } | undefined,
}))
vi.mock("@/hooks/usePlaceSummary", () => ({
  usePlaceSummary: () => ({
    places: placeState.places,
    summary: placeState.summary,
    multi: placeState.places.length >= 2,
    placeById: (id: number | null | undefined) => placeState.places.find((p) => p.id === id),
  }),
}))

const stats = {
  sessionsToday: 2,
  totalRevenueMonth: 1000000,
  totalPaidMonth: 600000,
  totalUnpaidMonth: 400000,
  unpaidPrevMonths: 150000,
  totalStudents: 5,
  totalSessionsMonth: 12,
  attendanceRate: 90,
  expectedRevenueMonth: 1200000,
  hasPlaceRate: false,
  placeIncomeMonth: 0,
  placeReceivedMonth: 0,
  teachingHoursMonth: 0,
}

vi.mock("@/lib/trpc", () => ({
  trpc: { report: { dashboard: { useQuery: () => ({ data: stats, isLoading: false }) } } },
}))
// Các khối dưới có test riêng; ở đây chỉ kiểm thẻ số liệu.
vi.mock("@/components/dashboard/StartCard", () => ({ StartCard: () => null }))
vi.mock("@/components/dashboard/DashboardAlerts", () => ({ DashboardAlerts: () => null }))
vi.mock("@/components/dashboard/TodaySessions", () => ({ TodaySessions: () => null }))
vi.mock("@/components/feedback/FeedbackPrompt", () => ({ FeedbackPrompt: () => null }))

function renderPage() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <DashboardPage />
    </LanguageProvider>
  )
}

function valueOf(label: string) {
  const card = screen.getAllByTestId("stat-card").find((c) => c.querySelector("p")?.textContent === label)
  if (!card) throw new Error(`Không thấy thẻ ${label}`)
  return card.querySelector('[data-testid="stat-value"]') as HTMLElement
}

describe("Dashboard — thẻ số liệu", () => {
  it("Đã thu tô màu nhấn, Còn nợ tô đỏ nợ, thẻ khác chữ chính semibold", () => {
    renderPage()
    expect(valueOf("Đã thu").className).toContain("text-primary")
    expect(valueOf("Còn nợ").className).toContain("text-debt")
    const plain = valueOf("Ca dạy hôm nay").className
    expect(plain).toContain("text-foreground")
    expect(plain).toContain("font-semibold")
    expect(plain).not.toContain("font-bold")
  })

  it("icon của cả 8 thẻ dùng chữ phụ, không còn màu rời rạc", () => {
    renderPage()
    const icons = screen.getAllByTestId("stat-card").flatMap((c) => [...c.querySelectorAll("svg")])
    expect(icons).toHaveLength(8)
    for (const svg of icons) expect(svg.getAttribute("class")).toContain("text-muted-foreground")
  })

  it("Còn nợ ghi riêng nợ tháng này và nợ các tháng trước", () => {
    renderPage()
    const card = valueOf("Còn nợ").closest('[data-testid="stat-card"]') as HTMLElement
    expect(card.textContent).toMatch(/Tháng này\s*250\.000\s*đ/)
    expect(card.textContent).toMatch(/Các tháng trước\s*150\.000\s*đ/)
  })
})

describe("Dashboard — chỉ dạy trung tâm (spec AL §4.4) [RF 2]", () => {
  it("không có ô tiền (Học phí đã dạy, Đã thu, Còn nợ, Học phí dự kiến)", () => {
    placeState.summary = { count: 1, hasPerStudent: false, hasPerSession: true }
    renderPage()
    const labels = screen.getAllByTestId("stat-card").map((c) => c.querySelector("p")?.textContent)
    for (const l of ["Còn nợ", "Đã thu", "Học phí dự kiến"]) expect(labels).not.toContain(l)
    expect(labels).toContain("Ca dạy hôm nay")
    placeState.summary = undefined
  })

  it("các ô còn lại (4 + Giờ dạy) nằm chung 1 lưới, ô lẻ cuối chiếm cả hàng ở mobile (không lỗ), không có nút Xem thêm (FIX AL F2)", () => {
    placeState.summary = { count: 1, hasPerStudent: false, hasPerSession: true }
    renderPage()
    const cards = screen.getAllByTestId("stat-card")
    expect(cards).toHaveLength(5)
    expect(cards[4].className).toContain("col-span-2")
    const grids = new Set(cards.map((c) => c.parentElement))
    expect(grids.size).toBe(1)
    expect([...grids][0]!.className).not.toContain("hidden")
    expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull()
    placeState.summary = undefined
  })
})

describe("Dashboard — thu nhập nơi dạy + giờ dạy (spec AM §4.3)", () => {
  const set = (o: Partial<typeof stats>) => Object.assign(stats, o)
  const reset = () => {
    set({ hasPlaceRate: false, placeIncomeMonth: 0, placeReceivedMonth: 0, teachingHoursMonth: 0 })
    placeState.summary = undefined
  }
  const labels = () => screen.getAllByTestId("stat-card").map((c) => c.querySelector("p")?.textContent)
  const card = (label: string) => screen.getAllByTestId("stat-card").find((c) => c.querySelector("p")?.textContent === label)!

  it("chỉ theo học sinh: không thêm thẻ Thu nhập, không có Giờ dạy", () => {
    placeState.summary = { count: 1, hasPerStudent: true, hasPerSession: false }
    renderPage()
    expect(labels()).not.toContain("Thu nhập tháng này")
    expect(labels()).not.toContain("Giờ dạy tháng này")
    reset()
  })

  it("hỗn hợp có đơn giá: Thu nhập = học phí + nơi, 2 dòng phụ; Giờ dạy", () => {
    placeState.summary = { count: 2, hasPerStudent: true, hasPerSession: true }
    set({ hasPlaceRate: true, placeIncomeMonth: 555000, placeReceivedMonth: 500000, teachingHoursMonth: 4.5 })
    renderPage()
    expect(valueOf("Thu nhập tháng này").textContent).toBe("1.555.000 đ")
    expect(card("Thu nhập tháng này").textContent).toContain("Học phí 1.000.000 đ")
    expect(card("Thu nhập tháng này").textContent).toContain("Nơi dạy 555.000 đ · đã nhận 500.000 đ")
    expect(valueOf("Giờ dạy tháng này").textContent).toBe("4,5 giờ")
    // 10 ô chung 1 lưới: không có hàng lửng giữa 2 lưới ở desktop.
    const cards = screen.getAllByTestId("stat-card")
    expect(cards).toHaveLength(10)
    expect(new Set(cards.map((c) => c.parentElement)).size).toBe(1)
    reset()
  })

  it("[RF 4] chỉ theo ca/giờ có đơn giá: thẻ Thu nhập chỉ có dòng Nơi dạy", () => {
    placeState.summary = { count: 1, hasPerStudent: false, hasPerSession: true }
    set({ hasPlaceRate: true, placeIncomeMonth: 555000, placeReceivedMonth: 0, teachingHoursMonth: 3 })
    renderPage()
    expect(valueOf("Thu nhập tháng này").textContent).toBe("555.000 đ")
    expect(card("Thu nhập tháng này").textContent).not.toContain("Học phí")
    expect(card("Thu nhập tháng này").textContent).toContain("Nơi dạy 555.000 đ")
    reset()
  })
})
