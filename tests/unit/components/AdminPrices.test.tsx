/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { toast } from "sonner"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminPrices } from "@/components/admin/AdminPrices"

type MutOpts = { onSuccess?: () => void; onError?: (e: { message: string; data?: { code?: string } | null }) => void }

const h = vi.hoisted(() => ({ mutate: vi.fn(), opts: null as null | MutOpts, invalidate: vi.fn(), data: undefined as unknown }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { prices: { invalidate: h.invalidate } } }),
    admin: {
      prices: { useQuery: () => ({ data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }) },
      updatePrices: {
        useMutation: (opts: MutOpts) => {
          h.opts = opts
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

const DATA = {
  monthly: { plus: 49000, pro: 99000 },
  history: [
    { id: 3, plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "admin_test", createdAt: "2026-09-27T03:05:00.000Z" },
    { id: 1, plan: "plus", monthPrice: 49000, previousMonthPrice: null, changedBy: "migration", createdAt: "2026-09-27T01:00:00.000Z" },
  ],
}

function renderPrices() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminPrices />
    </LanguageProvider>
  )
}
const plusInput = () => screen.getByRole("textbox", { name: "Giá tháng Plus" }) as HTMLInputElement
const proInput = () => screen.getByRole("textbox", { name: "Giá tháng Pro" }) as HTMLInputElement
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const saveButton = () => screen.getByRole("button", { name: "Lưu bảng giá" }) as HTMLButtonElement
const block = (plan: "plus" | "pro") => screen.getByTestId(`price-${plan}`).textContent ?? ""

beforeEach(() => {
  vi.clearAllMocks()
  h.opts = null
  h.data = DATA
})

describe("AdminPrices", () => {
  it("hiện giá hiện hành + xem trước 12/24 tháng; chưa đổi thì nút Lưu khóa", () => {
    renderPrices()
    expect(screen.getByRole("heading", { level: 1, name: "Bảng giá" })).toBeTruthy()
    expect(plusInput().value).toBe("49,000")
    expect(proInput().value).toBe("99,000")
    expect(block("plus")).toContain("12 tháng: 490.000 đ")
    expect(block("plus")).toContain("24 tháng: 980.000 đ")
    expect(block("pro")).toContain("12 tháng: 990.000 đ")
    expect(block("plus")).not.toContain("Hiện tại")
    expect(saveButton().disabled).toBe(true)
  })

  it("gõ 59000 → xem trước đổi ngay (chưa Lưu), hiện giá hiện tại, nút Lưu bật", () => {
    renderPrices()
    type(plusInput(), "59000")
    expect(block("plus")).toContain("12 tháng: 590.000 đ")
    expect(block("plus")).toContain("24 tháng: 1.180.000 đ")
    expect(block("plus")).toContain("Hiện tại: 49.000 đ/tháng")
    expect(saveButton().disabled).toBe(false)
  })

  it("Review Focus 1: gõ 59.000 có dấu chấm → thành 59, báo lỗi khoảng, nút Lưu khóa; để trống cũng lỗi", () => {
    renderPrices()
    type(plusInput(), "59.000")
    expect(plusInput().value).toBe("59")
    expect(block("plus")).toContain("Giá tháng từ 10.000 đến 1.000.000")
    expect(saveButton().disabled).toBe(true)
    type(plusInput(), "")
    expect(block("plus")).toContain("Giá tháng từ 10.000 đến 1.000.000")
    expect(saveButton().disabled).toBe(true)
  })

  it("giá lẻ 59900 hợp lệ; Pro ≤ Plus → lỗi dưới ô Pro, nút Lưu khóa", () => {
    renderPrices()
    type(plusInput(), "59900")
    expect(block("plus")).toContain("12 tháng: 599.000 đ")
    expect(saveButton().disabled).toBe(false)
    type(proInput(), "50000")
    expect(block("pro")).toContain("Giá Pro phải cao hơn giá Plus")
    expect(block("plus")).not.toContain("Giá Pro phải cao hơn giá Plus")
    expect(saveButton().disabled).toBe(true)
  })

  it("Lưu → hộp xác nhận chỉ có gói đổi, đủ 3 kỳ cũ → mới; Xác nhận gửi prices + expected", () => {
    renderPrices()
    type(plusInput(), "59000")
    fireEvent.click(saveButton())
    const confirm = screen.getByTestId("price-confirm")
    const txt = confirm.textContent ?? ""
    expect(txt).toContain("Đổi bảng giá?")
    for (const s of ["49.000 đ", "59.000 đ", "490.000 đ", "590.000 đ", "980.000 đ", "1.180.000 đ"]) expect(txt).toContain(s)
    expect(txt).not.toContain("Pro")
    expect(txt).toContain("Đơn đang chờ và gói đã mua giữ nguyên số tiền")
    fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận đổi giá" }))
    expect(h.mutate).toHaveBeenCalledWith({ prices: { plus: 59000, pro: 99000 }, expected: { plus: 49000, pro: 99000 } })
  })

  it("lỗi CONFLICT → toast message server + nạp lại bảng giá; lỗi khác không nạp lại", () => {
    renderPrices()
    act(() => h.opts!.onError!({ message: "Bảng giá vừa được đổi ở nơi khác, tải lại để xem", data: { code: "CONFLICT" } }))
    expect(toast.error).toHaveBeenCalledWith("Bảng giá vừa được đổi ở nơi khác, tải lại để xem")
    expect(h.invalidate).toHaveBeenCalledTimes(1)
    act(() => h.opts!.onError!({ message: "Giá chưa thay đổi", data: { code: "BAD_REQUEST" } }))
    expect(h.invalidate).toHaveBeenCalledTimes(1)
  })

  it("lịch sử: thẻ ghi gói, cũ → mới, người đổi, giờ VN; dòng seed ghi Giá ban đầu", () => {
    renderPrices()
    const cards = screen.getAllByTestId("price-history-card").map((c) => c.textContent)
    expect(cards[0]).toContain("Plus · 49.000 đ → 59.000 đ")
    expect(cards[0]).toContain("admin_test · 27/09/2026 10:05")
    expect(cards[1]).toContain("Plus · Giá ban đầu 49.000 đ")
    expect(cards[1]).toContain("migration")
  })
})
