/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

type Item = {
  id: number; studentId: number; studentName: string; studentDeleted: boolean; amount: number
  paidAt: string; year: number; month: number; createdAt: string; unread: boolean
}
type Data = { enabled: boolean; unread: number; items: Item[] }
type Opts = { action?: { label: string; onClick: () => void } } | undefined
const h = vi.hoisted(() => ({
  toast: vi.fn(),
  success: vi.fn(),
  push: vi.fn(),
  tour: false,
  inv: { tuition: vi.fn(), payment: vi.fn(), report: vi.fn() },
}))
vi.mock("sonner", () => ({ toast: Object.assign(h.toast, { success: h.success, error: vi.fn() }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/tour-store", () => ({ useTourActive: () => h.tour }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tuition: { invalidate: h.inv.tuition }, payment: { invalidate: h.inv.payment }, report: { invalidate: h.inv.report },
    }),
  },
}))

import { usePayosNoticeToasts } from "@/components/payos/usePayosNoticeToasts"

const item = (id: number, createdAt: string, over: Partial<Item> = {}): Item => ({
  id, studentId: 42, studentName: "Trần Thị Bé", studentDeleted: false, amount: 200000,
  paidAt: "2026-10-09T07:32:00.000Z", year: 2026, month: 8, createdAt, unread: true, ...over,
})
const OLD = item(1, "2026-10-09T07:00:00.000Z")
const onOpenBell = vi.fn()
const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider forcedLanguage="vi">{children}</LanguageProvider>
const run = (data: Data) => renderHook(({ d }: { d: Data }) => usePayosNoticeToasts(d, onOpenBell), { initialProps: { d: data }, wrapper })
const invalidated = () => h.inv.tuition.mock.calls.length + h.inv.payment.mock.calls.length + h.inv.report.mock.calls.length

beforeEach(() => {
  vi.clearAllMocks()
  h.tour = false
})

describe("usePayosNoticeToasts (spec AI §5)", () => {
  it("lần tải đầu, unread 2 → đúng 1 toast tóm tắt 'Có 2 khoản tiền mới qua payOS', không invalidate", () => {
    run({ enabled: true, unread: 2, items: [OLD, item(0, "2026-10-09T06:00:00.000Z")] })
    expect(h.toast).toHaveBeenCalledTimes(1)
    expect(h.toast.mock.calls[0][0]).toBe("Có 2 khoản tiền mới qua payOS")
    const opts = h.toast.mock.calls[0][1] as Opts
    expect(opts?.action?.label).toBe("Xem")
    opts?.action?.onClick()
    expect(onOpenBell).toHaveBeenCalled()
    expect(h.success).not.toHaveBeenCalled()
    expect(invalidated()).toBe(0)
  })
  it("lần tải đầu, unread 0 → không toast", () => {
    run({ enabled: true, unread: 0, items: [{ ...OLD, unread: false }] })
    expect(h.toast).not.toHaveBeenCalled()
    expect(h.success).not.toHaveBeenCalled()
  })
  it("lần sau có 1 dòng mới (createdAt lớn hơn) → toast.success 'PH của Trần Thị Bé đã chuyển 200.000 đ' + action Xem push deep link; invalidate tuition/payment/report", () => {
    const { rerender } = run({ enabled: true, unread: 0, items: [{ ...OLD, unread: false }] })
    rerender({ d: { enabled: true, unread: 1, items: [item(2, "2026-10-09T08:00:00.000Z"), { ...OLD, unread: false }] } })
    expect(h.success).toHaveBeenCalledTimes(1)
    expect(h.success.mock.calls[0][0]).toBe("PH của Trần Thị Bé đã chuyển 200.000 đ")
    const opts = h.success.mock.calls[0][1] as Opts
    expect(opts?.action?.label).toBe("Xem")
    opts?.action?.onClick()
    expect(h.push).toHaveBeenCalledWith("/tuition?year=2026&month=8&studentId=42")
    expect(h.inv.tuition).toHaveBeenCalled()
    expect(h.inv.payment).toHaveBeenCalled()
    expect(h.inv.report).toHaveBeenCalled()
  })
  it("lần sau có 4 dòng mới → 1 toast tóm tắt", () => {
    const { rerender } = run({ enabled: true, unread: 0, items: [{ ...OLD, unread: false }] })
    const fresh = [5, 4, 3, 2].map((n) => item(n, `2026-10-09T${10 + n}:00:00.000Z`))
    rerender({ d: { enabled: true, unread: 4, items: [...fresh, { ...OLD, unread: false }] } })
    expect(h.success).not.toHaveBeenCalled()
    expect(h.toast).toHaveBeenCalledTimes(1)
    expect(h.toast.mock.calls[0][0]).toBe("Có 4 khoản tiền mới qua payOS")
    expect(invalidated()).toBe(3)
  })
  it("dữ liệu không đổi (cùng createdAt mới nhất) → không toast lại", () => {
    const { rerender } = run({ enabled: true, unread: 0, items: [{ ...OLD, unread: false }] })
    const next = { enabled: true, unread: 1, items: [item(2, "2026-10-09T08:00:00.000Z"), { ...OLD, unread: false }] }
    rerender({ d: next })
    rerender({ d: { ...next, unread: 0 } })
    rerender({ d: { ...next } })
    expect(h.success).toHaveBeenCalledTimes(1)
    expect(h.inv.tuition).toHaveBeenCalledTimes(1)
  })
  it("đang chạy tour → hoãn; tour tắt → toast ra", () => {
    const { rerender } = run({ enabled: true, unread: 0, items: [{ ...OLD, unread: false }] })
    h.tour = true
    const next = { enabled: true, unread: 1, items: [item(2, "2026-10-09T08:00:00.000Z"), { ...OLD, unread: false }] }
    rerender({ d: next })
    expect(h.success).not.toHaveBeenCalled()
    h.tour = false
    rerender({ d: next })
    expect(h.success).toHaveBeenCalledTimes(1)
  })
  it("HS đã xoá → toast không có nút Xem", () => {
    const { rerender } = run({ enabled: true, unread: 0, items: [{ ...OLD, unread: false }] })
    rerender({ d: { enabled: true, unread: 1, items: [item(2, "2026-10-09T08:00:00.000Z", { studentDeleted: true }), { ...OLD, unread: false }] } })
    expect(h.success).toHaveBeenCalledTimes(1)
    expect(h.success.mock.calls[0][1]).toBeUndefined()
  })
})
