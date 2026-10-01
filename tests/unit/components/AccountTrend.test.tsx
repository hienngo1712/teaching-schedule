/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AccountTrend } from "@/components/admin/AccountTrend"
import { buildAccountTrend } from "@/lib/admin-stats"

const h = vi.hoisted(() => ({ inputs: [] as { days: number }[], data: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      accountTrend: {
        useQuery: (input: { days: number }) => {
          h.inputs.push(input)
          return { data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }
        },
      },
    },
  },
}))

const DAYS = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]
const TREND = buildAccountTrend(
  DAYS,
  [{ day: "2026-11-10", count: 3 }, { day: "2026-11-15", count: 1 }],
  [{ day: "2026-11-14", count: 5 }, { day: "2026-11-15", count: 2 }],
  "2026-11-12"
)
function renderTrend() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AccountTrend />
    </LanguageProvider>
  )
}

beforeEach(() => {
  h.inputs = []
  h.data = undefined
})

describe("AccountTrend (spec K T1–T6)", () => {
  it("mặc định 7 ngày; bấm 14 ngày / 30 ngày đổi input", () => {
    renderTrend()
    expect(h.inputs.at(-1)).toEqual({ days: 7 })
    expect(screen.getByRole("radio", { name: "7 ngày" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(screen.getByRole("radio", { name: "14 ngày" }))
    expect(h.inputs.at(-1)).toEqual({ days: 14 })
    fireEvent.click(screen.getByRole("radio", { name: "30 ngày" }))
    expect(h.inputs.at(-1)).toEqual({ days: 30 })
    expect(screen.getByRole("radio", { name: "30 ngày" }).className).toContain("h-11")
  })
  it("4 thẻ phụ, 7 cột, cột cuối mờ, nhãn cột, chú thích mốc ghi", () => {
    h.data = TREND
    renderTrend()
    expect(screen.getByTestId("trend-new").textContent).toContain("4")
    expect(screen.getByTestId("trend-avg").textContent).toContain("0,6")
    expect(screen.getByTestId("trend-returning").textContent).toContain("7")
    expect(screen.getByTestId("trend-busiest").textContent).toContain("10/11 · 3 tài khoản")
    const bars = screen.getAllByTestId("chart-bar")
    expect(bars).toHaveLength(7)
    expect(bars[6].getAttribute("data-faded")).toBe("true")
    expect(screen.getByRole("img", { name: "14/11: 0 tài khoản mới, 5 quay lại" })).toBeTruthy()
    expect(screen.getByText("Lượt quay lại được ghi từ 12/11/2026")).toBeTruthy()
    expect(screen.getByText("Hôm nay (chưa hết ngày)")).toBeTruthy()
  })

  it("trung bình/ngày theo ngôn ngữ: tiếng Anh dùng dấu chấm thập phân (spec U U24)", () => {
    h.data = TREND
    render(
      <LanguageProvider forcedLanguage="en">
        <AccountTrend />
      </LanguageProvider>
    )
    expect(screen.getByTestId("trend-avg").textContent).toContain("0.6")
    expect(screen.getByTestId("trend-avg").textContent).not.toContain("0,6")
  })
})
