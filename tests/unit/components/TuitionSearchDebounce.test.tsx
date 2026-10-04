/**
 * @vitest-environment jsdom
 */
// Bug prod: ô tìm tên ở Học phí gửi 1 query cho mỗi ký tự → phải chờ ngừng gõ 200ms.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import TuitionPage from "@/app/(app)/tuition/page"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: undefined, ready: true, fields: null, has: () => true }),
}))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tuition: { getMonthlyStatus: { invalidate: vi.fn() } } }),
    tuition: {
      getMonthlyStatus: {
        useQuery: () => ({ data: { items: [], totalCount: 0, totalPages: 0 }, isPending: false, isError: false, refetch: vi.fn() }),
      },
      getNotice: { useQuery: () => ({ data: undefined, isError: false, refetch: vi.fn() }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      list: { useQuery: () => ({ data: [], isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      record: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

const push = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  push.mockClear()
  vi.mocked(useRouter).mockReturnValue({ push, replace: push } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/tuition")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as ReturnType<typeof useSearchParams>)
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})
afterEach(() => vi.useRealTimers())

const searchPushes = () => push.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("studentName="))

describe("TuitionPage - ô tìm tên", () => {
  it("gõ 'Minh' từng ký tự → trong lúc gõ không tìm, ngừng 200ms thì tìm đúng 1 lần 'Minh'", () => {
    render(
      <LanguageProvider>
        <TuitionPage />
      </LanguageProvider>
    )
    const input = screen.getByPlaceholderText("Tìm tên học sinh...") as HTMLInputElement
    for (const v of ["M", "Mi", "Min", "Minh"]) {
      fireEvent.change(input, { target: { value: v } })
      expect(input.value).toBe(v)
      act(() => vi.advanceTimersByTime(50))
    }
    act(() => vi.advanceTimersByTime(149))
    expect(searchPushes()).toEqual([])
    act(() => vi.advanceTimersByTime(1))
    expect(searchPushes()).toHaveLength(1)
    expect(searchPushes()[0]).toContain("studentName=Minh")
  })
})
