/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentProps } from "react"
import { act, render, screen, fireEvent } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PlanPurchaseDialog } from "@/components/plan/PlanPurchaseDialog"
import { addDays, vnStartOfDay, type PlanFields } from "@/lib/plans"

type Me = RouterOutputs["plan"]["me"]
type CreateOpts = { onSuccess?: (res: { id: number; code: string; bonusMonths: number }) => void }

const mut = vi.hoisted(() => ({ create: vi.fn(), createOpts: null as null | CreateOpts }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    plan: {
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
    expect(mut.create).toHaveBeenCalledWith({ plan: "plus", period: "2year" })
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
})
