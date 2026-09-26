/**
 * @vitest-environment jsdom
 */
// Review #3: payload null (state "none"/"paid") nhưng dữ liệu refetch đổi (payments/paidAmount)
//   → phải chụp lại ảnh, không giữ blob cũ.
// Review #4: QRCode.toDataURL lỗi → phải báo lên Dialog (captureFailed), nút không kẹt loading mãi.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { TuitionNoticeDialog } from "@/components/tuition/TuitionNoticeDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- giữ tham số để khớp chữ ký thật
const elementToPngBlob = vi.fn((_el: HTMLElement): Promise<Blob> => Promise.resolve(new Blob(["x"])))

vi.mock("@/lib/share-image", () => ({
  canShareFiles: () => false,
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

vi.mock("@/lib/trpc", () => ({
  trpc: { tuition: { getNotice: { useQuery: () => queryReturn } } },
}))

beforeEach(() => {
  vi.clearAllMocks()
  toDataURLImpl = () => Promise.resolve("data:image/png;base64,x")
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
})
