/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"
import type { PaymentBatchDTO } from "@/lib/types/models"

const mockRecordMutate = vi.fn()
const mockUpdateSettlementMutate = vi.fn()
const mockDeleteBatchMutate = vi.fn()

const sampleLedgers = [
  { key: 2026 * 12 + 7, fee: 200_000, paid: 0, fullPaid: false },
  { key: 2026 * 12 + 8, fee: 600_000, paid: 0, fullPaid: false },
]

const sampleBatches: PaymentBatchDTO[] = [
  {
    batchId: "b-500",
    amount: 500_000,
    paidAt: "2026-09-15",
    note: "Đợt thu 1",
    allocations: [
      { year: 2026, month: 8, amount: 200_000 },
      { year: 2026, month: 9, amount: 300_000 },
    ],
    legacy: false,
  },
]

const rowData = {
  studentId: 1,
  fullName: "Nguyễn Văn Test",
  grade: 5,
  totalSessions: 6,
  presentSessions: 6,
  totalExpected: 600_000,
  paidAmount: 0,
  isFullPaid: false,
  notes: null,
  previousBalance: 200_000,
  totalAmountDue: 800_000,
  billingMode: "per_session" as const,
  monthlyFee: 0,
  noticeSentAt: null,
  noticeSentAmount: null,
  noticeStatus: "none" as const,
  inProgress: false,
  debtMonths: 1,
  year: 2026,
  month: 9,
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tuition: { getMonthlyStatus: { invalidate: vi.fn() }, invalidate: vi.fn() },
      payment: { invalidate: vi.fn() },
      client: { tuition: { updateSettlement: { mutate: vi.fn().mockResolvedValue({}) } } },
    }),
    tuition: {
      getMonthlyStatus: {
        useQuery: (input: { studentId: number; year: number; month: number }) => {
          const item = input.month === 10
            ? {
                ...rowData,
                year: 2026,
                month: 10,
                inProgress: true,
                presentSessions: 3,
                totalSessions: 3,
                previousBalance: 800_000,
                totalExpected: 300_000,
                totalAmountDue: 1_100_000,
              }
            : rowData
          return { data: { items: [item], totalCount: 1, totalPages: 1 }, isPending: false }
        },
      },
      ledgers: { useQuery: () => ({ data: sampleLedgers, isPending: false }) },
      updateSettlement: { useMutation: () => ({ mutate: mockUpdateSettlementMutate, isPending: false }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      listBatches: { useQuery: () => ({ data: sampleBatches, isPending: false }) },
      record: { useMutation: () => ({ mutate: mockRecordMutate, isPending: false }) },
      deleteBatch: { useMutation: () => ({ mutate: mockDeleteBatchMutate, isPending: false }) },
      updateBatch: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

function renderSheet(customData = rowData) {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <TuitionDetailSheet open data={customData} onOpenChange={() => {}} onSuccess={() => {}} />
    </LanguageProvider>
  )
}

describe("TuitionDetailSheetPay (spec Y §5)", () => {
  it("1. Không còn checkbox Đánh dấu đã đóng đủ, không còn nút Lưu ở footer", () => {
    renderSheet()
    expect(screen.queryByRole("checkbox", { name: /đã đóng đủ/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Lưu$/ })).toBeNull()
  })

  it("2. Bảng tiền tháng 9 có Tháng 8 còn thiếu 200.000 đ, Học phí tháng 9, Còn thiếu 800.000 đ", () => {
    renderSheet()
    expect(screen.getByText("Tháng 8 còn thiếu")).toBeDefined()
    expect(screen.getByText("+200.000 đ")).toBeDefined()
    expect(screen.getByText(/Tiền học tháng này/)).toBeDefined()
    expect(screen.getByText("+600.000 đ")).toBeDefined()
    expect(screen.getByText("Còn thiếu")).toBeDefined()
    expect(screen.getByText("800.000 đ")).toBeDefined()
  })

  it("3. Bấm Đã đóng đủ 800.000 đ → record.mutate với { studentId: 1, year: 2026, month: 9, amount: 800_000 }", () => {
    renderSheet()
    const payFullBtn = screen.getByRole("button", { name: "Đã đóng đủ 800.000 đ" })
    fireEvent.click(payFullBtn)
    expect(mockRecordMutate).toHaveBeenCalledWith({
      studentId: 1,
      year: 2026,
      month: 9,
      amount: 800_000,
    })
  })

  it("4. Bấm Đóng một phần → hiện ô số tiền, gõ 500000 → dòng xem trước → bấm Ghi nhận → record 500_000", () => {
    renderSheet()
    const partialBtn = screen.getByRole("button", { name: "Đóng một phần" })
    fireEvent.click(partialBtn)

    const amountInput = screen.getByLabelText("Số tiền phụ huynh đưa")
    fireEvent.change(amountInput, { target: { value: "500000" } })

    expect(screen.getByText(/Trừ vào T8: 200.000 đ, T9: 300.000 đ/)).toBeDefined()

    const submitBtn = screen.getByRole("button", { name: "Ghi nhận" })
    fireEvent.click(submitBtn)
    expect(mockRecordMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 1,
        year: 2026,
        month: 9,
        amount: 500_000,
      })
    )
  })

  it("5. Lịch sử: đợt 500k hiện '500.000 đ' và 'T8 200.000 đ · T9 300.000 đ'", () => {
    renderSheet()
    expect(screen.getByText("500.000 đ")).toBeDefined()
    expect(screen.getByText("T8 200.000 đ · T9 300.000 đ")).toBeDefined()
  })

  it("6. Ghi chú: gõ rồi blur → updateSettlement.mutate đúng 1 lần", () => {
    renderSheet()
    const textarea = screen.getByPlaceholderText("Nhập ghi chú thanh toán (nếu có)...")
    fireEvent.change(textarea, { target: { value: "Phụ huynh hẹn cuối tuần" } })
    expect(mockUpdateSettlementMutate).not.toHaveBeenCalled()

    fireEvent.blur(textarea)
    expect(mockUpdateSettlementMutate).toHaveBeenCalledTimes(1)
    expect(mockUpdateSettlementMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 1,
        year: 2026,
        month: 9,
        notes: "Phụ huynh hẹn cuối tuần",
      }),
      expect.anything()
    )
  })

  it("8. Tháng đang học theo buổi: bảng có Tháng 10 tạm tính · đã học 3 buổi, không có nút thu tiền", () => {
    const inProgressRow = {
      ...rowData,
      year: 2026,
      month: 10,
      inProgress: true,
      presentSessions: 3,
      totalSessions: 3,
      previousBalance: 800_000,
      totalExpected: 300_000,
      totalAmountDue: 1_100_000,
    }
    renderSheet(inProgressRow)
    expect(screen.getByText("Tháng 10 tạm tính · đã học 3 buổi")).toBeDefined()
    expect(screen.getByText("Cần đóng ngay")).toBeDefined()
    // Tháng đang học không thu tiền (người dùng chốt 2026-10-04): nợ cũ thu ở tháng trước
    expect(screen.queryByRole("button", { name: /^Đã đóng đủ/ })).toBeNull()
    expect(screen.getByTestId("pay-month-in-progress")).toBeDefined()
  })
})
