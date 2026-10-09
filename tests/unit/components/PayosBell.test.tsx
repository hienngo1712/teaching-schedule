/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

type Item = {
  id: number; studentId: number; studentName: string; studentDeleted: boolean; amount: number
  paidAt: string; year: number; month: number; createdAt: string; unread: boolean
}
type Data = { enabled: boolean; unread: number; items: Item[] }
const h = vi.hoisted(() => ({
  data: undefined as undefined | Data,
  opts: [] as Array<Record<string, unknown>>,
  markSeen: vi.fn(),
  setData: vi.fn(),
  push: vi.fn(),
  desktop: true,
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => h.desktop }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      payosNotice: { list: { setData: h.setData } },
      tuition: { invalidate: vi.fn() }, payment: { invalidate: vi.fn() }, report: { invalidate: vi.fn() },
    }),
    payosNotice: {
      list: { useQuery: (_: unknown, o: Record<string, unknown>) => { h.opts.push(o); return { data: h.data } } },
      markSeen: { useMutation: () => ({ mutate: h.markSeen }) },
    },
  },
}))

import { PayosBell } from "@/components/payos/PayosBell"

const ITEM: Item = {
  id: 5, studentId: 42, studentName: "Trần Thị Bé", studentDeleted: false, amount: 200000,
  paidAt: "2026-10-09T07:32:00.000Z", year: 2026, month: 8, createdAt: "2026-10-09T07:32:05.000Z", unread: true,
}
const lastQueryOpts = () => h.opts.at(-1) as { refetchInterval: (q: { state: { data?: Data } }) => number | false; refetchOnWindowFocus: boolean; refetchIntervalInBackground: boolean }
const renderBell = () => render(<LanguageProvider forcedLanguage="vi"><PayosBell /></LanguageProvider>)
const bell = () => screen.getByRole("button", { name: "Thông báo tiền học" })

beforeEach(() => {
  vi.clearAllMocks()
  h.opts = []
  h.desktop = true
})

describe("PayosBell (spec AI §5)", () => {
  it("enabled false → không render gì, không hỏi định kỳ", () => {
    h.data = { enabled: false, unread: 0, items: [] }
    const { container } = renderBell()
    expect(container.innerHTML).toBe("")
    expect(lastQueryOpts().refetchInterval({ state: { data: h.data } })).toBe(false)
  })
  it("enabled true → hỏi lại 30s, có hỏi khi quay lại tab, không hỏi khi tab ẩn", () => {
    h.data = { enabled: true, unread: 0, items: [] }
    renderBell()
    const o = lastQueryOpts()
    expect(o.refetchInterval({ state: { data: h.data } })).toBe(30_000)
    expect(o.refetchOnWindowFocus).toBe(true)
    expect(o.refetchIntervalInBackground).toBe(false)
  })
  it("huy hiệu số chưa đọc; >9 hiện 9+", () => {
    h.data = { enabled: true, unread: 3, items: [ITEM] }
    const { rerender } = renderBell()
    expect(bell().textContent).toContain("3")
    h.data = { enabled: true, unread: 12, items: [ITEM] }
    rerender(<LanguageProvider forcedLanguage="vi"><PayosBell /></LanguageProvider>)
    expect(bell().textContent).toContain("9+")
  })
  it("mở chuông → markSeen với createdAt mới nhất; danh sách hiện 'PH của Trần Thị Bé đã chuyển 200.000 đ'", async () => {
    h.data = { enabled: true, unread: 1, items: [ITEM, { ...ITEM, id: 4, createdAt: "2026-10-08T01:00:00.000Z", unread: false }] }
    renderBell()
    fireEvent.click(bell())
    expect(h.markSeen).toHaveBeenCalledWith({ upTo: "2026-10-09T07:32:05.000Z" })
    expect(h.setData).toHaveBeenCalled()
    const [row] = await screen.findAllByRole("button", { name: /PH của Trần Thị Bé đã chuyển 200\.000 đ/ })
    expect(row.textContent).toContain("14:32 ngày 9/10 · Học phí tháng 8")
  })
  it("unread 0 → mở chuông không gọi markSeen", async () => {
    h.data = { enabled: true, unread: 0, items: [{ ...ITEM, unread: false }] }
    renderBell()
    fireEvent.click(bell())
    await screen.findByText("Tiền học qua payOS")
    expect(h.markSeen).not.toHaveBeenCalled()
  })
  it("bấm dòng → push /tuition?year=2026&month=8&studentId=<id> và đóng", async () => {
    h.data = { enabled: true, unread: 0, items: [{ ...ITEM, unread: false }] }
    renderBell()
    fireEvent.click(bell())
    fireEvent.click(await screen.findByRole("button", { name: /Trần Thị Bé/ }))
    expect(h.push).toHaveBeenCalledWith("/tuition?year=2026&month=8&studentId=42")
    expect(screen.queryByText("Tiền học qua payOS")).toBeNull()
  })
  it("HS đã xoá → dòng không bấm được (không có link/nút)", async () => {
    h.data = { enabled: true, unread: 0, items: [{ ...ITEM, studentDeleted: true, unread: false }] }
    renderBell()
    fireEvent.click(bell())
    expect(await screen.findByText("Trần Thị Bé")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Trần Thị Bé/ })).toBeNull()
  })
  it("rỗng → chữ hướng dẫn", async () => {
    h.data = { enabled: true, unread: 0, items: [] }
    renderBell()
    fireEvent.click(bell())
    expect(await screen.findByText(/Chưa có khoản nào/)).toBeTruthy()
  })
  it("đủ 20 dòng → ghi chú chỉ hiện 20 khoản gần nhất", async () => {
    h.data = { enabled: true, unread: 0, items: Array.from({ length: 20 }, (_, i) => ({ ...ITEM, id: i + 1, unread: false })) }
    renderBell()
    fireEvent.click(bell())
    expect(await screen.findByText("Chỉ hiện 20 khoản gần nhất")).toBeTruthy()
  })
  it("mobile: mở Sheet thay Popover", async () => {
    h.desktop = false
    h.data = { enabled: true, unread: 0, items: [{ ...ITEM, unread: false }] }
    renderBell()
    fireEvent.click(bell())
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("Tiền học qua payOS")
  })
})
