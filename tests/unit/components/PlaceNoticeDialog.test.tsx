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
      get: { useQuery: () => ({ data: NOTICE, isError: false, dataUpdatedAt: 1, refetch: vi.fn() }) },
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

import { PlaceNoticeDialog } from "@/components/place-notice/PlaceNoticeDialog"

beforeEach(() => {
  state.markMutate.mockReset()
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

  it("Đánh dấu đã gửi bằng tay", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã gửi" }))
    expect(state.markMutate).toHaveBeenCalledWith({ placeId: 9, year: 2026, month: 10, sent: true })
  })
})
