/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentProps } from "react"
import { act, render, screen, fireEvent } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PlanPurchaseDialog } from "@/components/plan/PlanPurchaseDialog"
import { addDays, pricesFromMonthly, vnStartOfDay, type PlanFields } from "@/lib/plans"
import { toast } from "sonner"

type Me = RouterOutputs["plan"]["me"]
type CreateOpts = {
  onSuccess?: (res: { id: number; code: string; bonusMonths: number }) => void
  onError?: (e: { message: string; data?: { code?: string } | null }) => void
}

const mut = vi.hoisted(() => ({ create: vi.fn(), createOpts: null as null | CreateOpts, invalidate: vi.fn() }))
const meQ = vi.hoisted(() => ({ isFetching: true, refetch: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ plan: { me: { invalidate: mut.invalidate } } }),
    plan: {
      me: { useQuery: () => meQ },
      createOrder: {
        useMutation: (opts: CreateOpts) => {
          mut.createOpts = opts
          return { mutate: mut.create, isPending: false }
        },
      },
      cancelOrder: {
        useMutation: (opts: { onSuccess?: () => void }) => ({ mutate: () => opts.onSuccess?.(), isPending: false }),
      },
    },
  },
}))

const STD: PlanFields = { plan: "standard", planExpiresAt: null, trialEndsAt: null }
const FAR = new Date("2099-12-31T17:00:00.000Z")

function makeMe(over: Partial<Me> = {}): Me {
  return {
    plan: "standard",
    source: "free",
    expiresAt: null,
    paidPlan: "standard",
    planExpiresAt: null,
    trialEndsAt: null,
    activeStudents: 3,
    studentLimit: 10,
    plusCreditOrder: null,
    pendingOrder: null,
    orders: [],
    paymentReady: true,
    isAdmin: false,
    prices: pricesFromMonthly({ plus: 49000, pro: 99000 }),
    ...over,
  } as Me
}

function pendingOrder(id: number, code: string) {
  return {
    id,
    code,
    plan: "plus",
    period: "year",
    amount: 490000,
    bonusMonths: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    transferContent: `SM ${code}`,
    qr: { payload: "000201010212", bankShortName: "Vietcombank", accountNumber: "0123456789", accountName: "CHU APP TEST" },
  } as NonNullable<Me["pendingOrder"]>
}

type Props = ComponentProps<typeof PlanPurchaseDialog>

function renderDialog(over: Partial<Props> = {}) {
  const props: Props = { open: true, onOpenChange: vi.fn(), me: makeMe(), fields: STD, initialPlan: "pro", ...over }
  const ui = (p: Props) => (
    <LanguageProvider forcedLanguage="vi">
      <PlanPurchaseDialog {...p} />
    </LanguageProvider>
  )
  const view = render(ui(props))
  return { props, rerender: (next: Partial<Props>) => view.rerender(ui({ ...props, ...next })) }
}

const text = (id: string) => screen.getByTestId(id).textContent ?? ""
const checked = (id: string) => screen.getByTestId(id).getAttribute("aria-checked")

beforeEach(() => {
  vi.clearAllMocks()
  mut.createOpts = null
  meQ.isFetching = true
  meQ.refetch.mockReset()
})

describe("PlanPurchaseDialog", () => {
  it("mở: gói bấm + 12 tháng chọn sẵn; chỉ Plus/Pro; nhãn ưu đãi và Tối đa N tháng theo từng kỳ (mua mới)", () => {
    renderDialog()
    expect(screen.getByText("Mua / gia hạn gói")).toBeTruthy()
    expect(checked("purchase-plan-pro")).toBe("true")
    expect(checked("purchase-plan-plus")).toBe("false")
    expect(checked("purchase-period-year")).toBe("true")
    expect(screen.queryByTestId("purchase-plan-standard")).toBeNull()
    expect(text("purchase-plan-pro")).toContain("Khuyên dùng")
    expect(text("purchase-plan-pro")).toContain("Mọi thứ của gói Plus, thêm:")
    expect(text("purchase-plan-plus")).toContain("Tối đa 40 học sinh đang học")
    expect(text("purchase-period-month")).toContain("Tối đa 1 tháng sử dụng")
    expect(text("purchase-period-month")).not.toMatch(/Tặng|Tiết kiệm/)
    expect(text("purchase-period-year")).toContain("Tiết kiệm 2 tháng")
    expect(text("purchase-period-year")).toContain("Tối đa 12 tháng")
    expect(text("purchase-period-2year")).toContain("Tặng 2 tháng")
    expect(text("purchase-period-2year")).toContain("Tối đa 26 tháng")
    expect(text("purchase-summary")).toContain("Pro · 12 tháng")
    expect(text("purchase-summary")).toContain("990.000")
    expect(text("purchase-summary")).toContain("Tổng tiền thanh toán")
  })

  it("chọn Plus + 24 tháng → tổng 980.000 + Tặng 2 tháng; Tạo đơn gửi đúng lựa chọn", () => {
    renderDialog()
    fireEvent.click(screen.getByTestId("purchase-plan-plus"))
    fireEvent.click(screen.getByTestId("purchase-period-2year"))
    expect(checked("purchase-plan-plus")).toBe("true")
    expect(checked("purchase-period-2year")).toBe("true")
    expect(text("purchase-summary")).toContain("980.000")
    expect(text("purchase-summary")).toContain("Tặng 2 tháng")
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    expect(mut.create).toHaveBeenCalledWith({ plan: "plus", period: "2year", expectedAmount: 980000 })
  })

  it("gia hạn sớm Plus còn 45 ngày: 12 tháng Tặng 2 / Tối đa 14, 24 tháng Tặng 4 / Tối đa 28; lên Pro năm có +22 ngày quy đổi", () => {
    const fields: PlanFields = { plan: "plus", planExpiresAt: addDays(vnStartOfDay(new Date()), 45), trialEndsAt: null }
    const me = makeMe({ plan: "plus", source: "paid", paidPlan: "plus", plusCreditOrder: { amount: 490000, period: "year", bonusMonths: 0 } })
    renderDialog({ me, fields, initialPlan: "plus" })
    expect(text("purchase-period-year")).toContain("Tặng 2 tháng")
    expect(text("purchase-period-year")).toContain("Tối đa 14 tháng")
    expect(text("purchase-period-2year")).toContain("Tặng 4 tháng")
    expect(text("purchase-period-2year")).toContain("Tối đa 28 tháng")
    expect(text("purchase-summary")).not.toContain("ngày Pro")
    fireEvent.click(screen.getByTestId("purchase-plan-pro"))
    expect(text("purchase-summary")).toContain("+22 ngày Pro")
  })

  it("D7: Pro trả phí còn hạn → thẻ Plus khóa, ghi Gói Pro còn hạn tới", () => {
    const fields: PlanFields = { plan: "pro", planExpiresAt: FAR, trialEndsAt: null }
    renderDialog({ me: makeMe({ plan: "pro", source: "paid", paidPlan: "pro" }), fields })
    expect((screen.getByTestId("purchase-plan-plus") as HTMLButtonElement).disabled).toBe(true)
    expect(text("purchase-plan-plus")).toContain("Gói Pro còn hạn tới")
  })

  it("có đơn chờ → nhắc hủy đơn cũ; chưa mở thanh toán → nút Tạo đơn khóa", () => {
    renderDialog({ me: makeMe({ pendingOrder: pendingOrder(1, "OLDOLD"), paymentReady: false }) })
    expect(text("purchase-summary")).toContain("Tạo đơn mới sẽ hủy đơn đang chờ")
    expect(text("purchase-summary")).toContain("Chưa mở thanh toán")
    expect((screen.getByRole("button", { name: "Tạo đơn" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("tạo đơn xong: chờ refetch thì Skeleton (không hiện đơn cũ); đơn mới về thì hiện QR; Xong đóng popup", async () => {
    const { props, rerender } = renderDialog({ me: makeMe({ pendingOrder: pendingOrder(1, "OLDOLD") }) })
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onSuccess!({ id: 5, code: "NEWNEW", bonusMonths: 0 }))
    expect(screen.queryByTestId("purchase-summary")).toBeNull()
    expect(screen.queryByTestId("pending-order")).toBeNull()
    expect(screen.queryByText(/OLDOLD/)).toBeNull()

    rerender({ me: makeMe({ pendingOrder: pendingOrder(5, "NEWNEW") }) })
    expect((await screen.findByTestId("pending-order")).textContent).toContain("SM NEWNEW")
    fireEvent.click(screen.getByRole("button", { name: "Xong" }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("Hủy yêu cầu trong popup → đóng popup", async () => {
    const { props, rerender } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onSuccess!({ id: 7, code: "CANCEL", bonusMonths: 0 }))
    rerender({ me: makeMe({ pendingOrder: pendingOrder(7, "CANCEL") }) })
    fireEvent.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("giá theo me.prices: Plus 59.000 → 12 tháng 590.000; Tạo đơn gửi expectedAmount đang hiện", () => {
    renderDialog({ me: makeMe({ prices: pricesFromMonthly({ plus: 59000, pro: 129000 }) }), initialPlan: "plus" })
    expect(text("purchase-plan-plus")).toContain("59.000")
    expect(text("purchase-plan-pro")).toContain("129.000")
    expect(text("purchase-period-year")).toContain("590.000")
    expect(text("purchase-period-2year")).toContain("1.180.000")
    expect(text("purchase-summary")).toContain("590.000")
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    expect(mut.create).toHaveBeenCalledWith({ plan: "plus", period: "year", expectedAmount: 590000 })
  })

  it("server báo CONFLICT (giá vừa đổi) → toast giá đổi + nạp lại plan.me, popup giữ bước chọn", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onError!({ message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới", data: { code: "CONFLICT" } }))
    expect(toast.error).toHaveBeenCalledWith("Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn.")
    expect(mut.invalidate).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("purchase-summary")).toBeTruthy()
  })

  it("lỗi khác → toast đúng message server, không nạp lại plan.me", () => {
    renderDialog()
    act(() => mut.createOpts!.onError!({ message: "Chưa mở thanh toán", data: { code: "PRECONDITION_FAILED" } }))
    expect(toast.error).toHaveBeenCalledWith("Chưa mở thanh toán")
    expect(mut.invalidate).not.toHaveBeenCalled()
  })

  it("Review Focus 5: Plus còn 45 ngày chọn Pro năm; giá Pro đổi 129.000 → xem trước +17 ngày Pro theo giá đơn sẽ tạo", () => {
    const fields: PlanFields = { plan: "plus", planExpiresAt: addDays(vnStartOfDay(new Date()), 45), trialEndsAt: null }
    const me = makeMe({ plan: "plus", source: "paid", paidPlan: "plus", plusCreditOrder: { amount: 490000, period: "year", bonusMonths: 0 } })
    const { rerender } = renderDialog({ me, fields, initialPlan: "pro" })
    expect(text("purchase-summary")).toContain("+22 ngày Pro")
    rerender({ me: { ...me, prices: pricesFromMonthly({ plus: 49000, pro: 129000 }) } })
    // floor(60.411 × 365 / 1.290.000) = 17
    expect(text("purchase-summary")).toContain("+17 ngày Pro")
    expect(text("purchase-summary")).toContain("1.290.000")
  })

  it("tạo đơn xong mà refetch plan.me lỗi/không có đơn mới → hiện lỗi + mã SM + Thử lại (spec P J1)", () => {
    const { props, rerender } = renderDialog({ me: makeMe({ pendingOrder: pendingOrder(1, "OLDOLD") }) })
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onSuccess!({ id: 5, code: "NEWNEW", bonusMonths: 0 }))
    expect(screen.queryByTestId("purchase-load-error")).toBeNull() // còn đang fetch → Skeleton
    meQ.isFetching = false
    rerender(props)
    const box = screen.getByTestId("purchase-load-error")
    expect(box.textContent).toContain("Đã tạo đơn nhưng chưa tải được thông tin chuyển khoản.")
    expect(box.textContent).toContain("SM NEWNEW")
    const retry = screen.getByRole("button", { name: "Thử lại" })
    expect(retry.className).toContain("h-11")
    fireEvent.click(retry)
    expect(meQ.refetch).toHaveBeenCalled()
  })

  it("radiogroup kỳ hạn: mũi tên phải chọn kỳ kế tiếp, roving tabindex (spec P J3)", () => {
    renderDialog()
    const year = screen.getByTestId("purchase-period-year")
    expect(year.tabIndex).toBe(0)
    expect(screen.getByTestId("purchase-period-month").tabIndex).toBe(-1)
    year.focus()
    fireEvent.keyDown(year, { key: "ArrowRight" })
    expect(screen.getByTestId("purchase-period-2year").getAttribute("aria-checked")).toBe("true")
  })
})
