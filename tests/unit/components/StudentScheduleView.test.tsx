/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { StudentScheduleView } from "@/components/students/StudentScheduleView"
import type { SessionDTO } from "@/lib/types/models"

const h = vi.hoisted(() => ({ reportInputs: [] as unknown[], report: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    student: { list: { useQuery: () => ({ data: undefined, isPending: false }) } },
    report: {
      student: {
        useQuery: (input: unknown, opts?: { enabled?: boolean }) => {
          if (opts?.enabled !== false) h.reportInputs.push(input)
          return { data: opts?.enabled === false ? undefined : h.report }
        },
      },
    },
    tuition: { getMonthlyStatusReadOnly: { useQuery: () => ({ data: undefined, isLoading: false }) } },
  },
}))

// HS trọn tháng: link lưu fee 0, tiền thật nằm ở báo cáo server.
const session = (id: number, day: string, attendance: string) =>
  ({
    id,
    sessionDate: `2026-09-${day}T00:00:00.000Z`,
    startTime: "08:00",
    endTime: "09:00",
    status: "scheduled",
    subject: { id: 1, name: "Toán", color: "#000" },
    students: [{ studentId: 7, fullName: "HS Trọn gói", grade: 5, attendance, fee: 0, note: null, billingMode: "monthly" }],
  }) as unknown as SessionDTO

const sessions = [session(1, "03", "present"), session(2, "10", "absent")]

function renderView(revenue?: { expected: number; earned: number }) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <StudentScheduleView studentId={7} sessions={sessions} year={2026} month={9} revenue={revenue} />
    </LanguageProvider>
  )
}

beforeEach(() => {
  h.reportInputs = []
  h.report = { summary: { expectedRevenue: 400_000, totalRevenue: 400_000 } }
})

describe("StudentScheduleView — doanh thu HS trọn tháng (review T I2)", () => {
  it("dùng doanh thu server cho tháng đang xem, không cộng fee từng buổi", () => {
    renderView()
    expect(h.reportInputs).toEqual([{ studentId: 7, year: 2026, month: 9 }])
    expect(screen.getByText(/Học phí dự kiến/).textContent).toContain("400.000")
    expect(screen.getByText(/Học phí đã dạy/).textContent).toContain("400.000")
  })

  it("có prop revenue (báo cáo nhiều tháng) thì dùng nó, không gọi lại server", () => {
    renderView({ expected: 800_000, earned: 400_000 })
    expect(h.reportInputs).toEqual([])
    expect(screen.getByText(/Học phí dự kiến/).textContent).toContain("800.000")
  })

  it("dòng buổi của HS trọn tháng ghi Trọn tháng thay vì 0 đ", () => {
    renderView()
    expect(screen.getAllByText("Trọn tháng")).toHaveLength(2)
  })
})
