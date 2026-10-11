/**
 * @vitest-environment jsdom
 */
// Spec AN §1: hộp Phiếu báo nơi dạy — đủ dòng; Sao chép link tự đánh dấu đã gửi; chưa ngân hàng → link Cài đặt.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const state = vi.hoisted(() => ({
  markMutate: vi.fn(),
  linkMutateAsync: vi.fn(async () => ({ token: "t".repeat(43), path: `/n/${"t".repeat(43)}` })),
  notice: null as unknown,
  toDataURL: vi.fn<(payload: string, opts?: unknown) => Promise<string>>(async () => "data:image/png;base64,QR"),
}))

const NOTICE = {
  placeId: 9,
  placeName: "TT Ánh Dương",
  year: 2026,
  month: 10,
  teacherName: "Nguyễn Thu Hà",
  subjects: ["Toán 9"],
  doneDates: [
    { date: "2026-10-05", isMakeup: false },
    { date: "2026-10-12", isMakeup: true },
  ],
  cancelledDates: ["2026-10-08"],
  doneCount: 2,
  doneHours: 3,
  rate: { unit: "hour", amount: 185000 },
  expected: 555000,
  received: 100000,
  remaining: 455000,
  status: "partial",
  transferContent: "GV Ha T10 TT Anh Duong",
  qr: null,
  createdAt: "2026-10-20T05:00:00.000Z",
  sentAt: null,
  sentAmount: null,
  amountChanged: false,
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      placeNotice: { get: { invalidate: vi.fn() } },
      income: { month: { invalidate: vi.fn() } },
      client: { placeNotice: { markSent: { mutate: vi.fn(async () => ({})) } } },
    }),
    placeNotice: {
      get: { useQuery: () => ({ data: state.notice, isError: false, dataUpdatedAt: 1, refetch: vi.fn() }) },
      link: { useMutation: () => ({ mutateAsync: state.linkMutateAsync, isPending: false }) },
      markSent: { useMutation: () => ({ mutate: state.markMutate, isPending: false }) },
    },
  },
}))
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }))
vi.mock("@/lib/share-image", () => ({
  canShareFiles: () => false,
  elementToPngBlob: vi.fn(async () => new Blob(["x"])),
  shareOrDownloadPng: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("qrcode", () => ({ toDataURL: state.toDataURL }))

import { PlaceNoticeDialog } from "@/components/place-notice/PlaceNoticeDialog"

const WITH_QR = {
  ...NOTICE,
  bank: { bankShortName: "VCB", accountNumber: "0123456789", accountName: "NGUYEN THU HA" },
  qr: { payload: "000201...", amount: 455000, content: "GV Ha T10 TT Anh Duong" },
}

beforeEach(() => {
  state.markMutate.mockReset()
  state.notice = NOTICE
  state.toDataURL.mockReset()
  state.toDataURL.mockResolvedValue("data:image/png;base64,QR")
  vi.spyOn(console, "error").mockImplementation(() => {})
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } })
})

const renderDialog = () =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <PlaceNoticeDialog placeId={9} year={2026} month={10} onClose={() => {}} />
    </LanguageProvider>
  )

describe("PlaceNoticeDialog", () => {
  it("phiếu đủ dòng: gửi nơi, ngày dạy (bù), không tính (huỷ), số ca/giờ/đơn giá/thành tiền/đã nhận/còn phải trả", () => {
    renderDialog()
    const card = screen.getByTestId("place-notice-card")
    for (const text of [
      "Phiếu báo dạy kèm tháng 10/2026",
      "TT Ánh Dương",
      "Nguyễn Thu Hà",
      "Toán 9",
      "05/10, 12/10 (bù)",
      "Không tính: 08/10 (huỷ)",
      "185.000 đ/giờ",
      "555.000 đ",
      "100.000 đ",
      "455.000 đ",
    ]) {
      expect(card.textContent, text).toContain(text)
    }
    // Chưa có ngân hàng: không QR, có link Thêm tài khoản ngân hàng tới Cài đặt.
    expect(screen.queryByTestId("place-notice-qr")).toBeNull()
    expect(screen.getByRole("link", { name: "Thêm tài khoản ngân hàng" }).getAttribute("href")).toBe("/settings")
  })

  it("Sao chép link: chép /n/<token>?thang=2026-10 rồi tự đánh dấu đã gửi", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Sao chép link gửi" }))
    await waitFor(() => expect(state.markMutate).toHaveBeenCalledWith({ placeId: 9, year: 2026, month: 10, sent: true }))
    expect(state.linkMutateAsync).toHaveBeenCalledWith({ placeId: 9 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/n/${"t".repeat(43)}?thang=2026-10`)
  })

  // FIX AN F2: nút Tải ảnh chỉ xoay chờ QR; QR lỗi thì hết xoay và vẫn lưu được (ảnh không có QR).
  it("có QR: Tải ảnh xoay tới khi ảnh QR tải xong rồi bật", async () => {
    state.notice = WITH_QR
    renderDialog()
    const btn = screen.getByRole("button", { name: "Tải ảnh" })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    const img = await screen.findByAltText("VietQR")
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.load(img)
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
  })

  it("tạo QR lỗi: nút Tải ảnh hết xoay và bật lại, bấm là lưu", async () => {
    state.notice = WITH_QR
    state.toDataURL.mockRejectedValue(new Error("qr fail"))
    renderDialog()
    const btn = screen.getByRole("button", { name: "Tải ảnh" })
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
    expect(btn.querySelector(".animate-spin")).toBeNull()
    expect(screen.getByTestId("place-notice-qr").textContent).toContain("Không tạo được mã QR")
    fireEvent.click(btn)
    expect(state.markMutate).toHaveBeenCalledWith({ placeId: 9, year: 2026, month: 10, sent: true })
  })

  it("ảnh QR không hiển thị được (onError): nút Tải ảnh vẫn bật", async () => {
    state.notice = WITH_QR
    renderDialog()
    fireEvent.error(await screen.findByAltText("VietQR"))
    await waitFor(() => expect((screen.getByRole("button", { name: "Tải ảnh" }) as HTMLButtonElement).disabled).toBe(false))
  })

  // Spec AO §3: QR payOS có nhãn payOS + gợi ý tự xác nhận; tạo link lỗi → báo nhẹ, phiếu VietQR.
  it("QR payOS: ảnh alt payOS và dòng 'Quét để trả, tự xác nhận khi tiền vào'", async () => {
    state.notice = { ...WITH_QR, qr: { ...WITH_QR.qr, provider: "payos", content: "ND 5", checkoutUrl: "https://pay/1" } }
    renderDialog()
    expect(await screen.findByAltText("payOS")).toBeTruthy()
    expect(screen.getByTestId("place-notice-qr").textContent).toContain("Quét để trả, tự xác nhận khi tiền vào")
  })

  it("payosFailed: báo 'Chưa tạo được QR payOS'", () => {
    state.notice = { ...WITH_QR, payosFailed: true }
    renderDialog()
    expect(screen.getByText("Chưa tạo được QR payOS, phiếu dùng VietQR")).toBeTruthy()
  })

  it("Đánh dấu đã gửi bằng tay", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã gửi" }))
    expect(state.markMutate).toHaveBeenCalledWith({ placeId: 9, year: 2026, month: 10, sent: true })
  })
})
