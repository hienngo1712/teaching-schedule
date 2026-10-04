/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useCalendar } from "@/hooks/useCalendar"

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
})
