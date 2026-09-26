/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts"
import { formatCurrency } from "@/lib/utils"

const alerts = {
  year: 2026,
  month: 9,
  debts: [{ studentId: 1, fullName: "Nguyễn Văn An", grade: 5, amount: 1800000, months: 2 }],
  idleStudents: [{ studentId: 2, fullName: "Trần Bình", grade: 3 }],
  unrescheduled: [],
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
