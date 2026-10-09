/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminOrderHistory } from "@/components/admin/AdminOrderHistory"

const base = {
  plan: "pro", period: "month", amount: 99000, bonusMonths: 0, creditDays: 0, source: "user", note: null,
  grantedUntil: "2026-11-09T17:00:00.000Z", decidedAt: "2026-10-09T03:00:00.000Z", createdAt: "2026-10-09T02:00:00.000Z",
  username: "teacher_std", fullName: "GV",
}
const ROWS = [
  { ...base, id: 1, code: "PAY001", status: "approved", method: "payos", decidedBy: "payos" },
  { ...base, id: 2, code: "VQR002", status: "approved", method: "vietqr", decidedBy: "admin_test" },
  { ...base, id: 3, code: "DUP003", status: "approved", method: "payos", decidedBy: "payos", paidAmount: 198000, paidAt: "2026-10-09T13:15:00.000Z" },
]
vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { orderHistory: { useQuery: () => ({ data: ROWS, isPending: false, isError: false, refetch: vi.fn() }) } } },
}))

describe("AdminOrderHistory: nhãn payOS/VietQR (spec AG §6)", () => {
  it("đơn payOS có nhãn payOS và người duyệt 'Tự kích hoạt (payOS)'; đơn VietQR giữ tên admin", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <AdminOrderHistory />
      </LanguageProvider>
    )
    const cards = screen.getAllByTestId("admin-history-card")
    expect(within(cards[0]).getByText("payOS")).toBeTruthy()
    expect(within(cards[0]).getByText(/Tự kích hoạt \(payOS\)/)).toBeTruthy()
    expect(within(cards[1]).getByText("VietQR")).toBeTruthy()
    expect(within(cards[1]).getByText(/admin_test/)).toBeTruthy()
  })
  it("đơn đã duyệt mà nhận dư (trả 2 lần) hiện số đã nhận + nhắc hoàn tiền", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <AdminOrderHistory />
      </LanguageProvider>
    )
    const card = screen.getAllByTestId("admin-history-card")[2]
    expect(within(card).getByText(/Đã nhận 198\.000/)).toBeTruthy()
    expect(within(card).getByText(/dư 99\.000/)).toBeTruthy()
  })
})
