/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }))
vi.mock("@/hooks/useExcelExport", () => ({
  useExcelExport: () => ({
    isExporting: false,
    exportMonthlySchedule: vi.fn(),
    exportStudentSchedule: vi.fn(),
    exportGradeReport: vi.fn(),
    exportAttendanceSummary: vi.fn(),
  }),
}))
vi.mock("@/hooks/useCalendar", () => ({ useCalendar: () => ({ year: 2026, month: 9 }) }))
vi.mock("@/hooks/useFilters", () => ({ useFilters: () => ({ selectedGrade: null, selectedStudentId: null }) }))
vi.mock("@/lib/trpc", () => ({ trpc: { tuition: { getMonthlyStatus: { useQuery: () => ({ data: undefined }) } } } }))

import { ExportExcelButton } from "@/components/reports/ExportExcelButton"

function renderBtn(iconOnly?: boolean) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <ExportExcelButton sessions={[]} iconOnly={iconOnly} className="size-11 md:size-10" />
    </LanguageProvider>
  )
}

describe("ExportExcelButton (spec P10)", () => {
  it("iconOnly: tên truy cập + tooltip Xuất Excel, không có chữ hiển thị", () => {
    renderBtn(true)
    const btn = screen.getByRole("button", { name: "Xuất Excel" })
    expect(btn.getAttribute("title")).toBe("Xuất Excel")
    expect(btn.textContent).toBe("")
    expect(btn.className).toContain("size-11")
    expect(btn.querySelector("svg")).not.toBeNull()
  })
  it("mặc định (màn Báo cáo): vẫn có chữ Xuất Excel", () => {
    renderBtn()
    expect(screen.getByRole("button", { name: "Xuất Excel" }).textContent).toBe("Xuất Excel")
  })
})
