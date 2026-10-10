/**
 * @vitest-environment jsdom
 */
// AK [RF 2]: chế độ Khoảng ghi nhãn rút gọn để không tràn ở 360px.
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ReportPeriodPicker } from "@/components/reports/ReportPeriodPicker"

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), usePathname: vi.fn(), useSearchParams: vi.fn() }))

function renderAt(qs: string) {
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn() } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/reports")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(qs) as ReturnType<typeof useSearchParams>)
  render(
    <LanguageProvider forcedLanguage="vi">
      <ReportPeriodPicker />
    </LanguageProvider>
  )
  return screen.getByRole("button")
}

describe("ReportPeriodPicker — nhãn khoảng rút gọn", () => {
  it("cùng năm: T1–T3/2026", () => {
    expect(renderAt("type=range&year=2026&month=1&toYear=2026&toMonth=3").textContent).toBe("T1–T3/2026")
  })

  it("khác năm: T11/2025–T2/2026", () => {
    expect(renderAt("type=range&year=2025&month=11&toYear=2026&toMonth=2").textContent).toBe("T11/2025–T2/2026")
  })

  it("nút co được, cắt chữ thay vì tràn (không còn min-w-[200px])", () => {
    const btn = renderAt("type=range&year=2026&month=1&toYear=2026&toMonth=3")
    expect(btn.className).toContain("min-w-0")
    expect(btn.className).not.toContain("min-w-[200px]")
    expect(btn.querySelector(".truncate")?.textContent).toBe("T1–T3/2026")
  })
})
