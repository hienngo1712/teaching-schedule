/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PayosTuitionCard } from "@/components/settings/PayosTuitionCard"

type Status = { connected: boolean; connectedAt: string | null; featureUnlocked: boolean }
const h = vi.hoisted(() => ({
  status: null as null | Status,
  connect: vi.fn(),
  disconnect: vi.fn(),
  connectError: null as null | { message: string },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/common/ContactOwner", () => ({ ContactOwner: () => <div>contact</div> }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ payos: { status: { invalidate: vi.fn() } } }),
    payos: {
      status: { useQuery: () => ({ data: h.status, isPending: false, isError: false, refetch: vi.fn() }) },
      connect: { useMutation: () => ({ mutate: h.connect, isPending: false, error: h.connectError }) },
      disconnect: { useMutation: () => ({ mutate: h.disconnect, isPending: false }) },
    },
  },
}))

const renderCard = () =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <PayosTuitionCard />
    </LanguageProvider>
  )

beforeEach(() => {
  vi.clearAllMocks()
  h.connectError = null
})

describe("PayosTuitionCard (spec AH §4.2)", () => {
  it("chưa Pro: thấy lợi ích, ghi chú chi phí nguyên văn, link hướng dẫn, liên hệ; form bị khoá", () => {
    h.status = { connected: false, connectedAt: null, featureUnlocked: false }
    renderCard()
    expect(screen.getByText(/không phải rà sao kê/)).toBeTruthy()
    expect(screen.getByText(/100 giao dịch miễn phí trọn đời \+ 500 miễn phí trong 6 tháng/)).toBeTruthy()
    expect(screen.getByRole("link", { name: /hướng dẫn/i }).getAttribute("href")).toBe("/guide#payos-hoc-phi")
    expect(screen.getByText("contact")).toBeTruthy()
    expect(screen.getByTestId("locked-section")).toBeTruthy()
  })
  it("Pro chưa nối: 3 ô khoá + nút Kết nối gọi connect với giá trị đã nhập", () => {
    h.status = { connected: false, connectedAt: null, featureUnlocked: true }
    renderCard()
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "c1" } })
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "a1" } })
    fireEvent.change(screen.getByLabelText("Checksum Key"), { target: { value: "k1" } })
    expect(screen.getByLabelText("API Key").getAttribute("type")).toBe("password")
    fireEvent.click(screen.getByRole("button", { name: "Kết nối" }))
    expect(h.connect).toHaveBeenCalledWith({ clientId: "c1", apiKey: "a1", checksumKey: "k1" })
  })
  it("lỗi server hiện dưới form", () => {
    h.status = { connected: false, connectedAt: null, featureUnlocked: true }
    h.connectError = { message: "Không kết nối được payOS, kiểm tra lại 3 khoá" }
    renderCard()
    expect(screen.getByText("Không kết nối được payOS, kiểm tra lại 3 khoá")).toBeTruthy()
  })
  it("đã nối: hiện 'Đã kết nối payOS từ 9/10/2026', không có ô khoá, có nút Ngắt kết nối", () => {
    h.status = { connected: true, connectedAt: "2026-10-09T03:00:00Z", featureUnlocked: true }
    renderCard()
    expect(screen.getByText("Đã kết nối payOS từ 9/10/2026")).toBeTruthy()
    expect(screen.queryByLabelText("API Key")).toBeNull()
    expect(screen.getByRole("button", { name: "Ngắt kết nối" })).toBeTruthy()
    expect(screen.queryByText(/Tạm dừng/)).toBeNull()
  })
  it("đã nối nhưng hết Pro: hiện 'Tạm dừng' và vẫn có nút Ngắt kết nối", () => {
    h.status = { connected: true, connectedAt: "2026-10-09T03:00:00Z", featureUnlocked: false }
    renderCard()
    expect(screen.getByText(/Tạm dừng/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ngắt kết nối" })).toBeTruthy()
    expect(screen.queryByTestId("locked-section")).toBeNull()
  })
  it("Ngắt kết nối hỏi xác nhận bằng hộp của app rồi mới gọi disconnect", async () => {
    h.status = { connected: true, connectedAt: "2026-10-09T03:00:00Z", featureUnlocked: true }
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: "Ngắt kết nối" }))
    expect(h.disconnect).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog.textContent).toContain("Ngắt kết nối payOS?")
    fireEvent.click(screen.getAllByRole("button", { name: "Ngắt kết nối" }).at(-1)!)
    expect(h.disconnect).toHaveBeenCalled()
  })
})
