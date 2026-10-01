/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"

const mockSetNoticeSentMutate = vi.fn()

const rowBase = {
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
  billingMode: "per_session" as const,
  monthlyFee: 0,
  noticeSentAt: null as string | null,
  noticeSentAmount: null as number | null,
  noticeStatus: "none" as "none" | "sent" | "changed",
}

let currentRow = { ...rowBase }

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tuition: { getMonthlyStatus: { invalidate: vi.fn() } } }),
    tuition: {
      getMonthlyStatus: { useQuery: () => ({ data: { items: [currentRow] }, isPending: false }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setNoticeSent: { useMutation: () => ({ mutate: mockSetNoticeSentMutate, isPending: false }) },
    },
    payment: {
      list: { useQuery: () => ({ data: [], isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  currentRow = { ...rowBase }
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("TuitionDetailSheet - Đánh dấu đã gửi phiếu", () => {
  it("noticeStatus === 'none' -> có nút 'Đánh dấu đã gửi', bấm gọi setNoticeSent({ sent: true })", () => {
    currentRow = { ...rowBase, noticeStatus: "none", noticeSentAt: null }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open data={{ ...currentRow, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )

    const btn = screen.getByRole("button", { name: "Đánh dấu đã gửi" })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(mockSetNoticeSentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: true }),
      expect.anything()
    )
  })

  it("noticeStatus === 'sent' + noticeSentAt -> có dòng 'Phiếu báo: Đã gửi 30/9 lúc 20:15', nút 'Bỏ đánh dấu', bấm gọi setNoticeSent({ sent: false })", () => {
    currentRow = {
      ...rowBase,
      noticeStatus: "sent",
      noticeSentAt: "2026-09-30T13:15:00.000Z",
      noticeSentAmount: 400000,
    }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open data={{ ...currentRow, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )

    expect(screen.getByText("Phiếu báo: Đã gửi 30/9 lúc 20:15")).toBeDefined()
    const btn = screen.getByRole("button", { name: "Bỏ đánh dấu" })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(mockSetNoticeSentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: false }),
      expect.anything()
    )
  })
})
