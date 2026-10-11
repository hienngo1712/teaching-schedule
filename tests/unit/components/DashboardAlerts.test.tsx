/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts"
import { formatCurrency } from "@/lib/utils"

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

const alerts = {
  year: 2026,
  month: 9,
  debts: [{ studentId: 1, fullName: "Nguyễn Văn An", grade: 5, amount: 1800000, months: 2, isActive: true }],
  idleStudents: [{ studentId: 2, fullName: "Trần Bình", grade: 3 }],
  unrescheduled: [],
  placeShortfall: [] as { placeId: number; name: string; color: string; amount: number; year: number; month: number }[],
}

const mockPlan = vi.hoisted(() => ({ allow: true, alertsCalls: [] as unknown[] }))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: undefined, ready: true, fields: null, has: () => mockPlan.allow }),
}))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    report: {
      alerts: {
        useQuery: (...args: unknown[]) => {
          mockPlan.alertsCalls.push(args[1])
          return { data: alerts, isPending: false }
        },
      },
    },
  },
}))
// Dialog ca dạy kéo theo nhiều query tRPC, không liên quan màu của khối cảnh báo.
vi.mock("@/components/sessions/SessionDetailDialog", () => ({ SessionDetailDialog: () => null }))
vi.mock("@/components/sessions/SessionFormDialog", () => ({ SessionFormDialog: () => null }))

beforeEach(() => {
  mockPlan.allow = true
  mockPlan.alertsCalls.length = 0
})

describe("DashboardAlerts — màu", () => {
  it("tiền nợ đỏ nợ; số đếm nền màu nhấn; icon chữ phụ", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <DashboardAlerts />
      </LanguageProvider>
    )
    const debt = screen.getByTestId("alert-group-debt")
    expect(within(debt).getByText(formatCurrency(1800000)).className).toContain("text-debt")
    for (const id of ["alert-group-debt", "alert-group-idle"]) {
      const group = screen.getByTestId(id)
      expect(within(group).getByText("1").className).toContain("bg-primary/[0.08]")
      expect(group.querySelector("svg")!.getAttribute("class")).toContain("text-muted-foreground")
    }
  })

  it("chưa Pro: khung Cần chú ý có ổ khóa Pro, không gọi report.alerts", () => {
    mockPlan.allow = false
    render(
      <LanguageProvider forcedLanguage="vi">
        <DashboardAlerts />
      </LanguageProvider>
    )
    const locked = screen.getByTestId("alerts-locked")
    expect(locked.textContent).toContain("Có ở gói Pro")
    expect(screen.getByText("Cần chú ý")).toBeTruthy()
    expect(screen.queryByTestId("alert-group-debt")).toBeNull()
    expect(mockPlan.alertsCalls.every((opts) => (opts as { enabled?: boolean })?.enabled === false)).toBe(true)
  })
})

describe("DashboardAlerts — HS đã nghỉ còn nợ (spec P1)", () => {
  it("dòng HS đã nghỉ có nhãn xám Đã nghỉ; HS đang học không có", () => {
    alerts.debts.push({ studentId: 9, fullName: "Lê Cường", grade: 7, amount: 900000, months: 1, isActive: false })
    try {
      render(
        <LanguageProvider forcedLanguage="vi">
          <DashboardAlerts />
        </LanguageProvider>
      )
      const rows = within(screen.getByTestId("alert-group-debt")).getAllByTestId("alert-row")
      expect(within(rows[0]).queryByTestId("alert-debt-inactive")).toBeNull()
      const badge = within(rows[1]).getByTestId("alert-debt-inactive")
      expect(badge.textContent).toBe("Đã nghỉ")
      expect(badge.className).toContain("bg-slate-100")
    } finally {
      alerts.debts.pop()
    }
  })
})

describe("DashboardAlerts — nơi dạy còn thiếu tiền tháng trước (spec AM §4.3)", () => {
  it("dòng: tên nơi · số còn thiếu; bấm mở Thu nhập tháng trước", () => {
    alerts.placeShortfall = [{ placeId: 5, name: "TT Ánh Dương", color: "#0891B2", amount: 250000, year: 2026, month: 9 }]
    render(
      <LanguageProvider forcedLanguage="vi">
        <DashboardAlerts />
      </LanguageProvider>
    )
    const group = screen.getByTestId("alert-group-place")
    expect(within(group).getByText("Nơi dạy còn thiếu tiền tháng trước")).toBeTruthy()
    expect(within(group).getByText(formatCurrency(250000)).className).toContain("text-debt")
    expect(within(group).getByRole("link").getAttribute("href")).toBe("/timesheet?tab=income&year=2026&month=9")
    alerts.placeShortfall = []
  })
})
