/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

let mutationOptions: { onSuccess?: () => void; onError?: (err: Error) => void } = {}
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
      setNoticeSent: {
        useMutation: (opts?: { onSuccess?: () => void; onError?: (err: Error) => void }) => {
          mutationOptions = opts ?? {}
          return { mutate: mockSetNoticeSentMutate, isPending: false }
        },
      },
    },
    payment: {
      list: { useQuery: () => ({ data: [], isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mutationOptions = {}
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
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: true })
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
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: false })
    )
  })

  it("U1: mutation setNoticeSent lỗi -> toast.error được gọi đúng 1 lần", () => {
    currentRow = { ...rowBase, noticeStatus: "none", noticeSentAt: null }
    mockSetNoticeSentMutate.mockImplementation((_vars, opts) => {
      const err = new Error("Lỗi mạng")
      // Gọi cả onError của mutate nếu có, và onError của useMutation
      mutationOptions.onError?.(err)
      opts?.onError?.(err)
    })

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open data={{ ...currentRow, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )

    const btn = screen.getByRole("button", { name: "Đánh dấu đã gửi" })
    fireEvent.click(btn)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("U4: row.noticeStatus = 'changed' -> hiện chữ 'Đã gửi · số tiền đã đổi' (data-testid='notice-changed-hint'); 'sent' -> không hiện", () => {
    currentRow = {
      ...rowBase,
      noticeStatus: "changed",
      noticeSentAt: "2026-09-30T13:15:00.000Z",
      noticeSentAmount: 300000,
      totalAmountDue: 400000,
    }
    const { rerender } = render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open data={{ ...currentRow, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )

    const hint = screen.getByTestId("notice-changed-hint")
    expect(hint).toBeDefined()
    expect(hint.textContent).toContain("Đã gửi · số tiền đã đổi")

    // Khi noticeStatus === 'sent' -> không hiện
    currentRow = { ...currentRow, noticeStatus: "sent", noticeSentAmount: 400000 }
    rerender(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open data={{ ...currentRow, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )
    expect(screen.queryByTestId("notice-changed-hint")).toBeNull()
  })
})
