/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
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
  notes: "ghi chú cũ" as string | null,
  previousBalance: 200_000,
  totalAmountDue: 800_000,
  billingMode: "per_session" as "per_session" | "monthly",
  monthlyFee: 0,
  noticeSentAt: null,
  noticeSentAmount: null,
  noticeStatus: "none" as const,
  payosPaidAt: null,
  payosPaidAmount: null,
  inProgress: false,
  debtMonths: 1,
  year: 2026,
  month: 9,
}

let currentRow: typeof rowData = rowData

// useUtils thật ổn định giữa các lần render; object mới mỗi lần làm effect lưu-khi-đóng chạy cleanup lúc đang gõ.
const mockUtils = {
  tuition: { getMonthlyStatus: { invalidate: vi.fn() }, invalidate: vi.fn() },
  payment: { invalidate: vi.fn() },
  client: { tuition: { updateSettlement: { mutate: mockClientSettlement } } },
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => mockUtils,
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

describe("TuitionDetailSheet — khoá thu tiền tháng đang học (cả trọn tháng)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-15T03:00:00.000Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const monthlyInProgress = {
    ...rowData,
    month: 10,
    inProgress: true,
    billingMode: "monthly" as const,
    monthlyFee: 400_000,
    previousBalance: 0,
    totalExpected: 400_000,
    totalAmountDue: 400_000,
  }

  it("HS trọn tháng ở tháng đang học: không có nút thu tiền, có dòng nhắc + nút Sang tháng 9", () => {
    currentRow = monthlyInProgress
    const onGoToMonth = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionDetailSheet open data={monthlyInProgress} onOpenChange={() => {}} onSuccess={() => {}} onGoToMonth={onGoToMonth} />
      </LanguageProvider>
    )
    expect(screen.queryByRole("button", { name: /^Đã đóng đủ/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Đóng một phần" })).toBeNull()
    expect(screen.getByTestId("pay-month-in-progress").textContent).toContain("Tháng 10 chưa học xong")
    fireEvent.click(screen.getByRole("button", { name: "Sang tháng 9" }))
    expect(onGoToMonth).toHaveBeenCalledWith(2026, 9)
  })

  it("tháng đang học: menu ⋮ không có Miễn (kể cả trọn tháng)", () => {
    currentRow = monthlyInProgress
    renderSheet(monthlyInProgress)
    openMenu()
    expect(screen.queryByText("Miễn phần còn thiếu")).toBeNull()
  })
})

describe("TuitionDetailSheet — Miễn có lý do", () => {
  beforeEach(() => {
    mockUpdateSettlementMutate.mockReset()
    currentRow = rowData
  })

  function openWaive() {
    renderSheet()
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
  }

  it("miễn có lý do chưa thành công (lỗi mạng) → ô ghi chú giữ nguyên, onSuccess mới đổi", () => {
    openWaive()
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    const notesBox = screen.getByDisplayValue("ghi chú cũ")
    expect(notesBox).toBeDefined()
    const opts = mockUpdateSettlementMutate.mock.calls[0][1]
    act(() => opts.onSuccess())
    expect((notesBox as HTMLTextAreaElement).value).toBe("ghi chú cũ\nMiễn: x")
  })

  it("nhập lý do → gửi isFullPaid + notes nối 'Miễn: <lý do>' xuống dòng sau ghi chú cũ", () => {
    openWaive()
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "  hoàn cảnh khó khăn  " } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls[0][0]).toEqual({
      studentId: 1, year: 2026, month: 9, isFullPaid: true, notes: "ghi chú cũ\nMiễn: hoàn cảnh khó khăn",
    })
  })

  it("ghi chú trống → notes chỉ là 'Miễn: <lý do>'", () => {
    const empty = { ...rowData, notes: null }
    currentRow = empty
    renderSheet(empty)
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "con thứ 2" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls[0][0]).toEqual({
      studentId: 1, year: 2026, month: 9, isFullPaid: true, notes: "Miễn: con thứ 2",
    })
  })

  it("nối vào ghi chú đang gõ dở (chưa lưu), không mất chữ", () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú thanh toán (nếu có)..."), { target: { value: "đang gõ" } })
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls.at(-1)![0].notes).toBe("đang gõ\nMiễn: x")
  })

  it("Miễn có lý do thành công rồi đóng sheet ngay (chưa refetch): không gửi lại ghi chú", () => {
    const { unmount } = renderSheet()
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    act(() => mockUpdateSettlementMutate.mock.calls[0][1].onSuccess())
    unmount()
    expect(mockClientSettlement).not.toHaveBeenCalled()
  })

  it("blur lưu ghi chú thành công rồi đóng sheet ngay: không gửi lại", () => {
    const { unmount } = renderSheet()
    const box = screen.getByPlaceholderText("Nhập ghi chú thanh toán (nếu có)...")
    fireEvent.change(box, { target: { value: "hẹn thứ 7" } })
    fireEvent.blur(box)
    act(() => mockUpdateSettlementMutate.mock.calls[0][1].onSuccess())
    unmount()
    expect(mockClientSettlement).not.toHaveBeenCalled()
  })

  it("Miễn có lý do giữ nguyên khoảng trắng của ghi chú cũ", () => {
    const spaced = { ...rowData, notes: "  dòng 1  " }
    currentRow = spaced
    renderSheet(spaced)
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls[0][0].notes).toBe("  dòng 1  \nMiễn: x")
  })

  it("ghi chú cũ toàn khoảng trắng → notes chỉ là 'Miễn: <lý do>'", () => {
    const blank = { ...rowData, notes: "   " }
    currentRow = blank
    renderSheet(blank)
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls[0][0].notes).toBe("Miễn: x")
  })
})

