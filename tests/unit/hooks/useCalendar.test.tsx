/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useCalendar, buildCalendarGrid } from "@/hooks/useCalendar"

import { LanguageProvider } from "@/components/providers/LanguageProvider"

let mockParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/tuition",
  useSearchParams: () => mockParams,
}))

describe("useCalendar - defaultOffset (spec Y §4)", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider forcedLanguage="vi">{children}</LanguageProvider>
  )

  beforeEach(() => {
    vi.useFakeTimers()
    mockParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("không có params, defaultOffset = -1 (hôm nay 13/10/2026) → { year: 2026, month: 9 }", () => {
    vi.setSystemTime(new Date(2026, 9, 13)) // Tháng 10 (0-indexed: 9)
    const { result } = renderHook(() => useCalendar({ defaultOffset: -1 }), { wrapper })
    expect(result.current.year).toBe(2026)
    expect(result.current.month).toBe(9)
  })

  it("tháng 1 nhảy về tháng 12 năm trước khi defaultOffset = -1 (15/01/2026)", () => {
    vi.setSystemTime(new Date(2026, 0, 15)) // Tháng 1 (0-indexed: 0)
    const { result } = renderHook(() => useCalendar({ defaultOffset: -1 }), { wrapper })
    expect(result.current.year).toBe(2025)
    expect(result.current.month).toBe(12)
  })

  it("có query params trên URL thì ưu tiên query params", () => {
    vi.setSystemTime(new Date(2026, 9, 13))
    mockParams = new URLSearchParams("year=2026&month=7")
    const { result } = renderHook(() => useCalendar({ defaultOffset: -1 }), { wrapper })
    expect(result.current.year).toBe(2026)
    expect(result.current.month).toBe(7)
  })

  it("máy để múi giờ UTC, 01:00 ngày 1/10 giờ VN → vẫn là tháng 10 (offset 0) và tháng 9 (offset -1)", () => {
    const oldTz = process.env.TZ
    process.env.TZ = "UTC"
    try {
      vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z")) // 01:00 1/10 giờ VN, còn 30/9 giờ UTC
      const now = renderHook(() => useCalendar(), { wrapper })
      expect(now.result.current.month).toBe(10)
      const prev = renderHook(() => useCalendar({ defaultOffset: -1 }), { wrapper })
      expect(prev.result.current.year).toBe(2026)
      expect(prev.result.current.month).toBe(9)
    } finally {
      process.env.TZ = oldTz
    }
  })

  it("ô hôm nay theo ngày VN, không theo giờ máy (01:30 sáng 1/11 giờ VN, máy chạy UTC)", () => {
    const prev = process.env.TZ
    process.env.TZ = "UTC"
    try {
      const { grid } = buildCalendarGrid(2026, 11, [], new Date("2026-10-31T18:30:00Z"))
      expect(grid.filter((c) => c.isToday).map((c) => c.date)).toEqual(["2026-11-01"])
    } finally {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    }
  })
})
