/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { toDataURL } from "qrcode"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PendingOrderCard } from "@/components/plan/PendingOrderCard"

type Order = NonNullable<RouterOutputs["plan"]["me"]["pendingOrder"]>

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    plan: { cancelOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    contact: { get: { useQuery: () => ({ data: { phone: "0979479550", facebookUrl: null } }) } },
  },
}))

function order(over: Partial<Order> = {}): Order {
  return {
    id: 1,
    code: "ABC123",
    plan: "pro",
    period: "month",
    amount: 99000,
    bonusMonths: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    transferContent: "SM ABC123",
    method: "vietqr",
    payos: null,
    qr: { payload: "000201VIETQR", bankShortName: "Vietcombank", accountNumber: "0123456789", accountName: "CHU APP TEST" },
    ...over,
  } as unknown as Order
}

const renderCard = (o: Order) =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <PendingOrderCard order={o} paymentReady />
    </LanguageProvider>
  )

describe("PendingOrderCard", () => {
  it("đơn payOS: QR payOS từ payos.qr, nút Mở trang thanh toán tab mới, chữ nhắc payOS, không có Liên hệ", async () => {
    renderCard(order({ method: "payos", payos: { qr: "000201PAYOSQR", checkoutUrl: "https://pay.payos.vn/web/pl-1" } } as Partial<Order>))
    const img = await screen.findByAltText("payOS")
    expect(img).toBeTruthy()
    expect(vi.mocked(toDataURL)).toHaveBeenLastCalledWith("000201PAYOSQR", expect.anything())
    const open = screen.getByRole("link", { name: "Mở trang thanh toán" })
    expect(open.getAttribute("href")).toBe("https://pay.payos.vn/web/pl-1")
    expect(open.getAttribute("target")).toBe("_blank")
    expect(open.className).toContain("h-11")
    expect(screen.getByText("Quét QR để thanh toán, gói bật ngay khi tiền vào.")).toBeTruthy()
    expect(screen.getByTestId("pending-order").textContent).toContain("SM ABC123")
    expect(screen.queryByTestId("contact-owner")).toBeNull()
  })

  it("đơn VietQR: QR VietQR, dòng báo admin + khối Liên hệ chủ app", async () => {
    renderCard(order())
    expect(await screen.findByAltText("VietQR")).toBeTruthy()
    expect(vi.mocked(toDataURL)).toHaveBeenLastCalledWith("000201VIETQR", expect.anything())
    expect(screen.getByText("Chuyển khoản xong, báo admin để được duyệt:")).toBeTruthy()
    expect(screen.getByTestId("contact-owner")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Mở trang thanh toán" })).toBeNull()
  })
})
