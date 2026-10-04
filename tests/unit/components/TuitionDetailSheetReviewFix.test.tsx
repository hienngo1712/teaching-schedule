/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"

const mockUpdateSettlementMutate = vi.fn()
const mockClientSettlement = vi.fn().mockResolvedValue({})

const rowData = {
  studentId: 1,
  fullName: "Nguyễn Văn Test",
  grade: 5,
  totalSessions: 6,
  presentSessions: 6,
  totalExpected: 600_000,
  paidAmount: 0,
  isFullPaid: false,
  notes: "ghi chú cũ",
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

let currentRow: typeof rowData = rowData

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tuition: { getMonthlyStatus: { invalidate: vi.fn() }, invalidate: vi.fn() },
      payment: { invalidate: vi.fn() },
      client: { tuition: { updateSettlement: { mutate: mockClientSettlement } } },
    }),
    tuition: {
      getMonthlyStatus: {
        useQuery: () => ({ data: { items: [currentRow], totalCount: 1, totalPages: 1 }, isPending: false }),
      },
      ledgers: { useQuery: () => ({ data: [], isPending: false }) },
      updateSettlement: { useMutation: () => ({ mutate: mockUpdateSettlementMutate, isPending: false }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      listBatches: { useQuery: () => ({ data: [], isPending: false }) },
      record: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteBatch: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateBatch: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  currentRow = rowData
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

function renderSheet(data = rowData, open = true) {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <TuitionDetailSheet open={open} data={data} onOpenChange={() => {}} onSuccess={() => {}} />
    </LanguageProvider>
  )
}

function openMenu() {
  const trigger = screen.getAllByRole("button").find((b) => b.getAttribute("aria-haspopup") === "menu")!
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" })
}

describe("TuitionDetailSheet — sửa sau review Y", () => {
  it("tháng đang học theo buổi còn nợ cũ: menu ⋮ không có Miễn (miễn sẽ xoá cả tiền tháng đang học)", () => {
    const prov = { ...rowData, month: 10, inProgress: true, previousBalance: 200_000, totalExpected: 300_000, totalAmountDue: 500_000 }
    currentRow = prov
    renderSheet(prov)
    openMenu()
    expect(screen.queryByText("Miễn phần còn thiếu")).toBeNull()
  })

  it("tháng đã xong còn thiếu: menu ⋮ vẫn có Miễn", () => {
    renderSheet()
    openMenu()
    expect(screen.getByText("Miễn phần còn thiếu")).toBeDefined()
  })

  it("xác nhận miễn chỉ gửi isFullPaid, không gửi kèm notes cũ", () => {
    renderSheet()
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    const payload = mockUpdateSettlementMutate.mock.calls[0][0]
    expect(payload).toEqual({ studentId: 1, year: 2026, month: 9, isFullPaid: true })
  })

  it("bỏ miễn chỉ gửi isFullPaid: false", () => {
    const waived = { ...rowData, isFullPaid: true }
    currentRow = waived
    renderSheet(waived)
    openMenu()
    fireEvent.click(screen.getByText("Bỏ miễn"))
    expect(mockUpdateSettlementMutate.mock.calls[0][0]).toEqual({ studentId: 1, year: 2026, month: 9, isFullPaid: false })
  })

  it("blur ghi chú chỉ gửi notes, không gửi isFullPaid cũ", () => {
    renderSheet()
    const textarea = screen.getByPlaceholderText("Nhập ghi chú thanh toán (nếu có)...")
    fireEvent.change(textarea, { target: { value: "lý do miễn" } })
    fireEvent.blur(textarea)
    expect(mockUpdateSettlementMutate.mock.calls[0][0]).toEqual({ studentId: 1, year: 2026, month: 9, notes: "lý do miễn" })
  })

  it("gõ ghi chú rồi đóng sheet (không blur) → vẫn lưu ghi chú", () => {
    const { rerender } = renderSheet()
    const textarea = screen.getByPlaceholderText("Nhập ghi chú thanh toán (nếu có)...")
    fireEvent.change(textarea, { target: { value: "hẹn thứ 7" } })
    rerender(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open={false} data={rowData} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )
    expect(mockClientSettlement).toHaveBeenCalledWith({ studentId: 1, year: 2026, month: 9, notes: "hẹn thứ 7" })
  })

  it("đóng sheet khi ghi chú không đổi → không gọi lưu", () => {
    const { rerender } = renderSheet()
    rerender(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open={false} data={rowData} onOpenChange={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    )
    expect(mockClientSettlement).not.toHaveBeenCalled()
  })
})
