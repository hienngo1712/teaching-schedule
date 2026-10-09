/**
 * @vitest-environment jsdom
 */
// Review #3: payload null (state "none"/"paid") nhưng dữ liệu refetch đổi (payments/paidAmount)
//   → phải chụp lại ảnh, không giữ blob cũ.
// Review #4: QRCode.toDataURL lỗi → phải báo lên Dialog (captureFailed), nút không kẹt loading mãi.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { TuitionNoticeDialog } from "@/components/tuition/TuitionNoticeDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

import { toast } from "sonner"
import { saveAs } from "file-saver"
import { shareOrDownloadPng } from "@/lib/share-image"

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- giữ tham số để khớp chữ ký thật
const elementToPngBlob = vi.fn((_el: HTMLElement): Promise<Blob> => Promise.resolve(new Blob(["x"])))

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

vi.mock("@/lib/share-image", () => ({
  canShareFiles: vi.fn(() => false),
  elementToPngBlob: (el: HTMLElement) => elementToPngBlob(el),
  shareOrDownloadPng: vi.fn(),
}))

let toDataURLImpl: () => Promise<string> = () => Promise.resolve("data:image/png;base64,x")
vi.mock("qrcode", () => ({
  toDataURL: () => toDataURLImpl(),
}))

function notice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    studentId: 1,
    fullName: "Nguyễn Văn A",
    grade: 5,
    year: 2026,
    month: 5,
    presentSessions: 4,
    currentMonthFee: 400000,
    previousBalance: 0,
    totalAmountDue: 400000,
    paidAmount: 400000,
    isFullPaid: false,
    presentDates: [],
    payments: [],
    remaining: 0,
    overpaid: 0,
    teacherName: "GV",
    bankConfigured: false,
    qr: null,
    ...overrides,
  }
}

let queryReturn: { data: unknown; isError: boolean; dataUpdatedAt: number; refetch: () => void }
const mockSetNoticeSentMutate = vi.fn()
const mockInvalidate = vi.fn()
const mockClientSetNoticeSentMutate = vi.fn().mockResolvedValue({})
let noticeMutationOptions: { onSuccess?: (res: unknown, vars: { studentId: number; year: number; month: number; sent: boolean }) => void; onError?: () => void } = {}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tuition: { getMonthlyStatus: { invalidate: mockInvalidate } },
      client: {
        tuition: {
          setNoticeSent: { mutate: mockClientSetNoticeSentMutate },
        },
      },
    }),
    tuition: {
      getNotice: { useQuery: () => queryReturn },
      setNoticeSent: {
        useMutation: (opts?: typeof noticeMutationOptions) => {
          noticeMutationOptions = opts ?? {}
          return { mutate: mockSetNoticeSentMutate, isPending: false }
        },
      },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  toDataURLImpl = () => Promise.resolve("data:image/png;base64,x")
  window.URL.createObjectURL = vi.fn().mockReturnValue("blob:x")
  window.URL.revokeObjectURL = vi.fn()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("TuitionNoticeDialog", () => {
  it("payload null (đã trả đủ), dữ liệu refetch đổi paidAmount → chụp lại ảnh (không giữ blob cũ)", async () => {
    queryReturn = { data: notice({ paidAmount: 400000 }), isError: false, dataUpdatedAt: 1000, refetch: vi.fn() }
    const { rerender } = render(
      <LanguageProvider>
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    await waitFor(() => expect(elementToPngBlob).toHaveBeenCalledTimes(1))

    // Refetch đổi paidAmount (vd hoàn tiền/sửa payment) nhưng vẫn payload null → dataUpdatedAt đổi.
    queryReturn = { data: notice({ paidAmount: 350000 }), isError: false, dataUpdatedAt: 2000, refetch: vi.fn() }
    rerender(
      <LanguageProvider>
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    await waitFor(() => expect(elementToPngBlob).toHaveBeenCalledTimes(2))
  })

  it("QRCode.toDataURL lỗi → hiện thông báo lỗi, nút không kẹt loading mãi", async () => {
    toDataURLImpl = () => Promise.reject(new Error("qr fail"))
    queryReturn = {
      data: notice({ remaining: 100000, qr: { payload: "x", bankShortName: "VCB", accountNumber: "1", accountName: "A", amount: 100000, content: "c" } }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }
    render(
      <LanguageProvider>
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    await waitFor(() => expect(screen.getByText("Không tải được dữ liệu")).toBeTruthy())
    // Nút Tải ảnh không còn ở trạng thái loading (icon spin) mãi mãi.
    const downloadBtn = screen.getByRole("button", { name: /Tải ảnh/ })
    expect(downloadBtn.querySelector(".animate-spin")).toBeNull()
  })

  it("mobile: có nút Lưu ảnh thay vì Tải ảnh, bấm mở viewer khi có blob", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    // Khi ở mobile, có nút Lưu ảnh, không có Tải ảnh
    expect(screen.queryByRole("button", { name: /Tải ảnh/ })).toBeNull()
    const saveImgBtn = screen.getByRole("button", { name: /Lưu ảnh/ })
    expect(saveImgBtn).toBeDefined()

    // Chờ elementToPngBlob hoàn thành
    await waitFor(() => expect(saveImgBtn.getAttribute("disabled")).toBeNull())

    // Bấm nút Lưu ảnh → mở viewer
    fireEvent.click(saveImgBtn)
    expect(screen.getByText(/Nhấn giữ ảnh → chọn Lưu vào Ảnh/)).toBeDefined()
  })

  // Review V I1: đánh dấu đã gửi → refetch → card chụp lại ảnh; màn Lưu ảnh không được tắt/mở lại dưới tay người dùng.
  it("mobile: đang mở màn Lưu ảnh mà dữ liệu tải lại → màn xem ảnh vẫn giữ nguyên", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    queryReturn = { data: notice(), isError: false, dataUpdatedAt: 1000, refetch: vi.fn() }
    const ui = () => (
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )
    const { rerender } = render(ui())
    const saveImgBtn = screen.getByRole("button", { name: /Lưu ảnh/ })
    await waitFor(() => expect(saveImgBtn.getAttribute("disabled")).toBeNull())
    fireEvent.click(saveImgBtn)
    expect(screen.getByText(/Nhấn giữ ảnh → chọn Lưu vào Ảnh/)).toBeDefined()

    // Lần chụp lại sau refetch chưa xong.
    elementToPngBlob.mockReturnValueOnce(new Promise<Blob>(() => {}))
    queryReturn = { ...queryReturn, dataUpdatedAt: 2000 }
    rerender(ui())
    await waitFor(() => expect(elementToPngBlob).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/Nhấn giữ ảnh → chọn Lưu vào Ảnh/)).toBeDefined()
  })

  it("desktop: bấm Tải ảnh → gọi saveAs và gọi setNoticeSent(sent: true), toast có Hoàn tác", async () => {
    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    const downloadBtn = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(downloadBtn.getAttribute("disabled")).toBeNull())

    fireEvent.click(downloadBtn)
    expect(saveAs).toHaveBeenCalled()
    expect(mockSetNoticeSentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: true })
    )
  })

  it("toast Hoàn tác → gọi setNoticeSent(sent: false)", async () => {
    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    const downloadBtn = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(downloadBtn.getAttribute("disabled")).toBeNull())

    // Mock mutate trigger hook onSuccess callback
    mockSetNoticeSentMutate.mockImplementationOnce((vars) => {
      noticeMutationOptions.onSuccess?.(undefined, vars)
    })

    fireEvent.click(downloadBtn)
    expect(toast).toHaveBeenCalled()
    const toastCall = vi.mocked(toast).mock.calls[0]
    const toastOptions = toastCall[1] as { action?: { onClick?: () => void } }
    expect(toastOptions?.action).toBeDefined()

    // Bấm Hoàn tác gọi client mutate
    toastOptions.action!.onClick!()
    expect(mockClientSetNoticeSentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: false })
    )
  })

  it("chia sẻ 'shared' → gọi setNoticeSent(sent: true)", async () => {
    const { canShareFiles } = await import("@/lib/share-image")
    vi.mocked(canShareFiles).mockReturnValue(true)
    vi.mocked(shareOrDownloadPng).mockResolvedValue("shared")

    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    const shareBtn = screen.getByRole("button", { name: /Chia sẻ/ })
    await waitFor(() => expect(shareBtn.getAttribute("disabled")).toBeNull())

    fireEvent.click(shareBtn)
    await waitFor(() => {
      expect(mockSetNoticeSentMutate).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: true })
      )
    })
  })

  it("chia sẻ 'aborted' → KHÔNG gọi setNoticeSent", async () => {
    const { canShareFiles } = await import("@/lib/share-image")
    vi.mocked(canShareFiles).mockReturnValue(true)
    vi.mocked(shareOrDownloadPng).mockResolvedValue("aborted")

    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    const shareBtn = screen.getByRole("button", { name: /Chia sẻ/ })
    await waitFor(() => expect(shareBtn.getAttribute("disabled")).toBeNull())

    fireEvent.click(shareBtn)
    await waitFor(() => expect(shareOrDownloadPng).toHaveBeenCalled())
    expect(mockSetNoticeSentMutate).not.toHaveBeenCalled()
  })

  it("mobile: bấm Lưu ảnh → gọi setNoticeSent(sent: true)", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    const saveImgBtn = screen.getByRole("button", { name: /Lưu ảnh/ })
    await waitFor(() => expect(saveImgBtn.getAttribute("disabled")).toBeNull())

    fireEvent.click(saveImgBtn)
    expect(mockSetNoticeSentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: true })
    )
  })

  it("U3: unmount dialog trước khi mutation resolve -> sau khi resolve vẫn gọi toast với action Hoàn tác, bấm Hoàn tác gọi client mutate với sent: false", async () => {
    queryReturn = {
      data: notice({ paidAmount: 400000 }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }

    const { unmount } = render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )

    const downloadBtn = screen.getByRole("button", { name: "Tải ảnh" })
    await waitFor(() => expect(downloadBtn.getAttribute("disabled")).toBeNull())

    fireEvent.click(downloadBtn)
    expect(mockSetNoticeSentMutate).toHaveBeenCalled()

    // Unmount dialog trước khi mutation resolve
    unmount()

    // Mutation resolve ở hook level
    noticeMutationOptions.onSuccess?.(undefined, { studentId: 1, year: 2026, month: 5, sent: true })

    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Đã đánh dấu đã gửi phiếu"),
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Hoàn tác",
          onClick: expect.any(Function),
        }),
      })
    )

    // Gọi action onClick của toast
    const toastCall = vi.mocked(toast).mock.calls[0]
    const action = (toastCall[1] as unknown as { action: { onClick: () => void } }).action
    action.onClick()

    expect(mockClientSetNoticeSentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, year: 2026, month: 5, sent: false })
    )
  })

  // Spec AH §4.2: payOS không cần tài khoản VietQR; có QR payOS thì không nhắc "chưa cài tài khoản".
  it("chưa cài TK VietQR nhưng phiếu có QR payOS → không hiện cảnh báo chưa cài tài khoản", async () => {
    queryReturn = {
      data: notice({ remaining: 100000, bankConfigured: false, qr: { provider: "payos", checkoutUrl: "https://pay/1", payload: "x", bankShortName: "MB", accountNumber: "1", accountName: "A", amount: 100000, content: "HP 1" } }),
      isError: false,
      dataUpdatedAt: 1000,
      refetch: vi.fn(),
    }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )
    expect(screen.queryByText(/Chưa cài tài khoản ngân hàng/)).toBeNull()
  })
  it("chưa cài TK và không có QR → vẫn hiện cảnh báo như cũ", async () => {
    queryReturn = { data: notice({ remaining: 100000, bankConfigured: false, qr: null }), isError: false, dataUpdatedAt: 1000, refetch: vi.fn() }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeDialog studentId={1} year={2026} month={5} onClose={() => {}} />
      </LanguageProvider>
    )
    expect(screen.getByText(/Chưa cài tài khoản ngân hàng/)).toBeTruthy()
  })
})
