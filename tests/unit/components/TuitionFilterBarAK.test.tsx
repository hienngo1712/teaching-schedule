/**
 * @vitest-environment jsdom
 */
// AK: Học phí dùng thanh lọc mới — Trạng thái ngoài thanh, Phiếu báo + Lớp trong Bộ lọc có chip.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import TuitionPage from "@/app/(app)/tuition/page"

const queryInputs = vi.hoisted(() => [] as unknown[])

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
        useQuery: (input: unknown) => {
          queryInputs.push(input)
          return { data: { items: [], totalCount: 0, totalPages: 0 }, isPending: false, isError: false, refetch: vi.fn() }
        },
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

function renderAt(qs: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(qs) as ReturnType<typeof useSearchParams>)
  return render(
    <LanguageProvider forcedLanguage="vi">
      <TuitionPage />
    </LanguageProvider>
  )
}

beforeEach(() => {
  push.mockClear()
  queryInputs.length = 0
  vi.mocked(useRouter).mockReturnValue({ push, replace: push } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/tuition")
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("Học phí — thanh lọc AK", () => {
  it("đang lọc Lớp 5: lọc đúng lớp, có chip Lớp 5, nút Bộ lọc (1); bấm chip thì bỏ lọc lớp", () => {
    renderAt("grade=5")
    expect(queryInputs.at(-1)).toMatchObject({ grade: 5 })
    expect(screen.getByRole("button", { name: "Bộ lọc (1)" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Bỏ lọc Lớp 5" }))
    const url = String(push.mock.calls.at(-1)?.[0])
    expect(url).not.toContain("grade=")
  })

  it("Trạng thái nằm ngoài thanh (không cần mở Bộ lọc) và không tính vào số (n)", () => {
    renderAt("status=unpaid")
    // Bộ lọc đang đóng mà vẫn thấy ô Trạng thái → ô nằm ngoài thanh.
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getAllByRole("combobox").some((c) => c.textContent?.includes("Chưa đóng"))).toBe(true)
    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Bỏ lọc/ })).toBeNull()
  })

  // FIX AK F1: điện thoại nhãn tháng ngắn "T9/2026" để ô Trạng thái hiện đủ chữ.
  it("điện thoại: bước tháng ghi T9/2026, ô Trạng thái rộng theo chữ (không bị ép co)", () => {
    renderAt("year=2026&month=9&status=paid_this_month")
    expect(screen.getByText("T9/2026")).toBeTruthy()
    expect(screen.queryByText(/Tháng 9/)).toBeNull()
    const status = screen.getAllByRole("combobox").find((c) => c.textContent?.includes("Đóng đủ tháng này"))!
    expect(status.className).toContain("w-auto")
    expect((status.parentElement as HTMLElement).className).toContain("shrink-0")
  })

  it("Xoá lọc bỏ Phiếu báo + Lớp, giữ Trạng thái", () => {
    renderAt("grade=5&noticeFilter=unsent&status=unpaid")
    expect(screen.getByRole("button", { name: "Bỏ lọc Phiếu báo: Chưa gửi" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xoá lọc" }))
    const url = String(push.mock.calls.at(-1)?.[0])
    expect(url).not.toContain("grade=")
    expect(url).not.toContain("noticeFilter=")
    expect(url).toContain("status=unpaid")
  })
})
