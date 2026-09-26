/**
 * @vitest-environment jsdom
 */
// Mở /tuition?studentId=… khi plan.me chưa về: sheet chi tiết không được gọi payment.list (Standard sẽ nhận FORBIDDEN).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import TuitionPage from "@/app/(app)/tuition/page"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: undefined, ready: false, fields: null, has: () => false }),
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
}

const paymentListOpts: ({ enabled?: boolean } | undefined)[] = []

vi.mock("@/lib/trpc", () => ({
  trpc: {
    tuition: {
      getMonthlyStatus: {
        useQuery: () => ({ data: { items: [item], totalCount: 1, totalPages: 1 }, isPending: false, isError: false, refetch: vi.fn() }),
      },
      getNotice: { useQuery: () => ({ data: undefined, isError: false, refetch: vi.fn() }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      list: {
        useQuery: (_input: unknown, opts?: { enabled?: boolean }) => {
          paymentListOpts.push(opts)
          return { data: [], isPending: false }
        },
      },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  paymentListOpts.length = 0
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn() } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/tuition")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("studentId=1") as ReturnType<typeof useSearchParams>)
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("TuitionPage - chưa biết gói", () => {
  it("deep link studentId mở sheet nhưng không gọi payment.list", () => {
    render(
      <LanguageProvider>
        <TuitionPage />
      </LanguageProvider>
    )
    expect(screen.queryAllByText("Chi tiết học phí").length).toBeGreaterThan(0)
    expect(paymentListOpts.length).toBeGreaterThan(0)
    for (const opts of paymentListOpts) expect(opts?.enabled).toBe(false)
  })
})
