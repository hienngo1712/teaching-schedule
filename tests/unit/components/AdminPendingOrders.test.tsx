/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminPendingOrders } from "@/components/admin/AdminPendingOrders"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/admin/NewAccounts", () => ({ NewAccounts: () => null }))

const base = {
  plan: "pro", period: "month", amount: 99000, bonusMonths: 0, userId: 2, username: "teacher_std", fullName: "GV",
  createdAt: "2026-10-01T03:00:00.000Z", expiresAt: "2026-10-08T03:00:00.000Z",
  preview: { grantedUntil: "2026-11-09T17:00:00.000Z", creditDays: 0 },
}
const paid = { paidAmount: 99000, paidAt: "2026-10-09T13:15:00.000Z", method: "payos" }
const DATA = {
  users: [],
  pendingOrders: [{ ...base, id: 1, code: "VQR001", method: "vietqr" }],
  attentionOrders: [
    { ...base, ...paid, id: 2, code: "EXP002", status: "expired" },
    { ...base, ...paid, id: 3, code: "SHT003", status: "pending", paidAmount: 79000 },
    { ...base, ...paid, id: 4, code: "CAN004", status: "cancelled" },
    { ...base, ...paid, id: 5, code: "REJ005", status: "rejected" },
  ],
}
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      overview: { useQuery: () => ({ data: DATA, isPending: false, isError: false, refetch: vi.fn() }) },
      approveOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rejectOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

const renderPage = () =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminPendingOrders />
    </LanguageProvider>
  )

describe("AdminPendingOrders: đơn payOS cần xử lý (spec AG §6)", () => {
  it("đơn cần xử lý nằm trước đơn chờ, đúng câu theo trạng thái, có Xác nhận + Từ chối, nhãn payOS/VietQR", () => {
    renderPage()
    const att = screen.getAllByTestId("attention-order")
    expect(att).toHaveLength(4)
    const firstPending = screen.getAllByTestId("pending-order-card")[0]
    expect(att[0].compareDocumentPosition(firstPending) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(att[0].textContent).toContain("Đã chuyển 99.000 đ lúc 20:15 09/10 nhưng đơn đã hết hạn. Duyệt?")
    expect(att[1].textContent).toContain("Đã chuyển 79.000 đ lúc 20:15 09/10 nhưng còn thiếu 20.000 đ. Duyệt?")
    expect(att[2].textContent).toContain("nhưng đơn đã huỷ. Duyệt?")
    expect(att[3].textContent).toContain("nhưng đơn đã bị từ chối. Duyệt?")
    for (const a of att) {
      expect(a.className).toContain("border-red-300")
      expect(within(a).getByRole("button", { name: "Xác nhận" })).toBeTruthy()
      expect(within(a).getByRole("button", { name: "Từ chối" })).toBeTruthy()
      expect(a.textContent).toContain("payOS")
    }
    expect(firstPending.textContent).toContain("VietQR")
  })

  it("Từ chối đơn có tiền: hộp xác nhận nhắc tự hoàn tiền", async () => {
    renderPage()
    fireEvent.click(within(screen.getAllByTestId("attention-order")[0]).getByRole("button", { name: "Từ chối" }))
    expect((await screen.findByRole("alertdialog")).textContent).toContain("Tiền đã vào tài khoản của bạn, nhớ tự hoàn cho khách.")
  })
})
