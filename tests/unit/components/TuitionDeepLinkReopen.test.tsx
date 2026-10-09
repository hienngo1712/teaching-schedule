/**
 * @vitest-environment jsdom
 */
// Review AI #3: đang ở /tuition, mở HS từ chuông → đóng → mở lại cùng HS phải mở sheet lần nữa.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

const item = {
  studentId: 1,
  fullName: "Nguyễn Văn A",
  grade: 5,
  totalSessions: 4,
  presentSessions: 4,
  totalExpected: 400000,
  paidAmount: 0,
  isFullPaid: false,
  notes: null,
  previousBalance: 0,
  totalAmountDue: 400000,
  billingMode: "per_session" as "per_session" | "monthly",
  monthlyFee: 0,
  noticeSentAt: null,
  noticeSentAmount: null,
  noticeStatus: "none" as const,
  inProgress: false,
  debtMonths: 0,
}

const getMonthlyStatusQuery = {
  data: { items: [item], totalCount: 1, totalPages: 1 },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tuition: { getMonthlyStatus: { invalidate: vi.fn() } } }),
    tuition: {
      getMonthlyStatus: { useQuery: () => getMonthlyStatusQuery },
      getNotice: { useQuery: () => ({ data: undefined, isError: false, refetch: vi.fn() }) },
      ledgers: { useQuery: () => ({ data: [], isPending: false }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      list: { useQuery: () => ({ data: [], isPending: false }) },
      listBatches: { useQuery: () => ({ data: [], isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteBatch: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      record: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn() } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/tuition")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as ReturnType<typeof useSearchParams>)
  // TuitionDetailSheet/TuitionNoticeDialog dùng useMediaQuery → jsdom không có matchMedia mặc định.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

const page = () => (
  <LanguageProvider>
    <TuitionPage />
  </LanguageProvider>
)
const setQs = (qs: string) =>
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(qs) as ReturnType<typeof useSearchParams>)

describe("TuitionPage - deep link studentId mở lại", () => {
  it("đóng sheet rồi URL lại có studentId cùng HS → sheet mở lại", async () => {
    setQs("year=2026&month=8&studentId=1")
    const { rerender } = render(page())
    expect(screen.queryAllByText("Chi tiết học phí").length).toBeGreaterThan(0)

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    setQs("year=2026&month=8")
    rerender(page())
    await waitFor(() => expect(screen.queryByText("Chi tiết học phí")).toBeNull())

    setQs("year=2026&month=8&studentId=1")
    rerender(page())
    await waitFor(() => expect(screen.queryAllByText("Chi tiết học phí").length).toBeGreaterThan(0))
  })
})
