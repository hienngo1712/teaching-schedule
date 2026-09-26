/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import DashboardPage from "@/app/(app)/dashboard/page"

const stats = {
  sessionsToday: 2,
  totalRevenueMonth: 1000000,
  totalPaidMonth: 600000,
  totalUnpaidMonth: 400000,
  totalStudents: 5,
  totalSessionsMonth: 12,
  attendanceRate: 90,
  expectedRevenueMonth: 1200000,
}

vi.mock("@/lib/trpc", () => ({
  trpc: { report: { dashboard: { useQuery: () => ({ data: stats, isLoading: false }) } } },
}))
// Hai khối dưới có test riêng; ở đây chỉ kiểm thẻ số liệu.
vi.mock("@/components/dashboard/DashboardAlerts", () => ({ DashboardAlerts: () => null }))
vi.mock("@/components/dashboard/TodaySessions", () => ({ TodaySessions: () => null }))

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
})
