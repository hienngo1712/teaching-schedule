/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CurrentPlanSummary } from "@/components/plan/CurrentPlanSummary"

type Me = RouterOutputs["plan"]["me"]
const base = { plan: "standard", source: "free", expiresAt: null, activeStudents: 3 } as unknown as Me
const ui = (over: Partial<Me>) =>
  render(<LanguageProvider forcedLanguage="vi"><CurrentPlanSummary me={{ ...base, ...over } as Me} /></LanguageProvider>)

describe("CurrentPlanSummary", () => {
  it("Pro đã mua: tiêu đề Gói hiện tại: Pro, dòng hạn kèm số HS", () => {
    ui({ plan: "pro", source: "paid", expiresAt: "2027-09-25T17:00:00.000Z", activeStudents: 8 } as Partial<Me>)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Gói hiện tại: Pro")
    expect(screen.getByTestId("plan-current").textContent).toContain("Dùng đến hết ngày 25/09/2027 (đang có 8 học sinh đang học)")
  })

  it("dùng thử: có nhãn Dùng thử", () => {
    ui({ plan: "pro", source: "trial", expiresAt: "2026-11-01T17:00:00.000Z", activeStudents: 12 } as Partial<Me>)
    const box = screen.getByTestId("plan-current")
    expect(box.textContent).toContain("Dùng thử")
    expect(box.textContent).toContain("Dùng đến hết ngày 01/11/2026 (đang có 12 học sinh đang học)")
  })

  it("Standard không hạn: chỉ số HS, không có dòng hạn", () => {
    ui({})
    const box = screen.getByTestId("plan-current")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Gói hiện tại: Standard")
    expect(box.textContent).toContain("Đang có 3 học sinh đang học")
    expect(box.textContent).not.toContain("Dùng đến hết ngày")
  })
})
