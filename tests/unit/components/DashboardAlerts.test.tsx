/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
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

vi.mock("@/lib/trpc", () => ({
  trpc: { report: { alerts: { useQuery: () => ({ data: alerts, isPending: false }) } } },
}))
// Dialog ca dạy kéo theo nhiều query tRPC, không liên quan màu của khối cảnh báo.
vi.mock("@/components/sessions/SessionDetailDialog", () => ({ SessionDetailDialog: () => null }))
vi.mock("@/components/sessions/SessionFormDialog", () => ({ SessionFormDialog: () => null }))

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
})
