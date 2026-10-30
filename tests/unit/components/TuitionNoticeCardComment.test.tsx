/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import type { TuitionNoticeDTO } from "@/lib/types/models"

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,x"),
}))

const base: TuitionNoticeDTO = {
  studentId: 1, fullName: "HS A", grade: 5, year: 2026, month: 10, totalSessions: 2, presentSessions: 2,
  billingMode: "per_session", monthlyFee: 0, currentMonthFee: 200000, previousBalance: 0, totalAmountDue: 200000,
  paidAmount: 0, isFullPaid: false,
  presentDates: [{ date: "2026-10-05", fee: 100000 }, { date: "2026-10-12", fee: 100000 }],
  payments: [], remaining: 200000, overpaid: 0, inProgress: false, debtMonths: 0, teacherName: "GV",
  bankConfigured: true,
  qr: { provider: "vietqr", checkoutUrl: null, payload: "PAYLOAD", bankShortName: "VCB", accountNumber: "1", accountName: "A", amount: 200000, content: "c" },
  parentComment: null,
}

const renderCard = (notice: TuitionNoticeDTO, variant?: "default" | "wide") =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <TuitionNoticeCard notice={notice} variant={variant} />
    </LanguageProvider>
  )

describe("TuitionNoticeCard: mục Nhận xét tháng (AT)", () => {
  it("không có nhận xét → không hiện mục", () => {
    renderCard(base)
    expect(screen.queryByTestId("notice-comment")).toBeNull()
    expect(screen.queryByText("Nhận xét")).toBeNull()
  })

  it("có nhận xét → hiện tiêu đề + nội dung, giữ xuống dòng (pre-wrap), nằm sau Ngày học và trước QR", async () => {
    renderCard({ ...base, parentComment: "Con ngoan.\nCần luyện thêm phép chia." })
    const box = screen.getByTestId("notice-comment")
    expect(box.textContent).toContain("Nhận xét")
    const body = box.querySelector(".whitespace-pre-wrap")
    expect(body?.textContent).toBe("Con ngoan.\nCần luyện thêm phép chia.")

    const img = await waitFor(() => screen.getByAltText("VietQR"))
    // DOCUMENT_POSITION_FOLLOWING = 4: QR đứng sau mục nhận xét.
    expect(box.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const dates = screen.getByText("Ngày học:", { exact: false })
    expect(dates.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("nội dung có thẻ HTML → hiện chữ thường, không dựng phần tử", () => {
    const { container } = renderCard({ ...base, parentComment: "<b>đậm</b><img src=x onerror=alert(1)>" })
    expect(screen.getByTestId("notice-comment").textContent).toContain("<b>đậm</b>")
    expect(container.querySelector("b")).toBeNull()
    expect(container.querySelector("img[src='x']")).toBeNull()
  })

  it("bản rộng (trang phụ huynh) cũng hiện nhận xét", () => {
    renderCard({ ...base, parentComment: "Tốt" }, "wide")
    expect(screen.getByTestId("notice-comment").textContent).toContain("Tốt")
  })
})
