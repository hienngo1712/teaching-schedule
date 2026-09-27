/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CopyMonthDialog } from "@/components/sessions/CopyMonthDialog"

type QueryOpts = { enabled?: boolean }
type MutOpts = { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }

const h = vi.hoisted(() => ({
  allowed: true,
  ready: true,
  error: null as unknown,
  refetch: vi.fn(),
  openUpgrade: vi.fn(),
  preview: null as unknown,
  inputs: [] as unknown[],
  opts: [] as QueryOpts[],
  mutate: vi.fn(),
  mutOpts: null as MutOpts | null,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({ allowed: h.allowed, locked: h.ready && !h.allowed, requiredPlan: "plus", openUpgrade: h.openUpgrade, guard: (fn: () => void) => fn }),
}))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    session: {
      copyMonthPreview: {
        useQuery: (input: unknown, opts: QueryOpts) => {
          h.inputs.push(input)
          h.opts.push(opts)
          return { data: opts.enabled && !h.error ? h.preview : undefined, error: h.error, isFetching: false, isPlaceholderData: false, refetch: h.refetch }
        },
      },
      copyMonth: {
        useMutation: (opts: MutOpts) => {
          h.mutOpts = opts
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

const MON = "0|17:00|19:00|1"
const TUE = "1|17:00|18:00|1"
const SAT = "5|10:00|11:00|1"
const subject = { id: 1, name: "Toán", color: "#0F766E" }
const count = (over: Record<string, number> = {}) => ({ year: 2030, month: 2, slots: 4, created: 4, existing: 0, conflict: 0, past: 0, ...over })
const PREVIEW = {
  patterns: [
    { key: MON, weekday: 0, startTime: "17:00", endTime: "19:00", subject, title: "Nhóm A", studentCount: 2, droppedInactive: 1, kind: "regular", lastDate: "2030-01-28", selected: true, perMonth: [count({ created: 3, conflict: 1 })] },
    { key: TUE, weekday: 1, startTime: "17:00", endTime: "18:00", subject, title: null, studentCount: 1, droppedInactive: 0, kind: "stopped", lastDate: "2030-01-08", selected: false, perMonth: [count({ created: 0 })] },
    { key: SAT, weekday: 5, startTime: "10:00", endTime: "11:00", subject, title: null, studentCount: 1, droppedInactive: 0, kind: "single", lastDate: "2030-01-26", selected: false, perMonth: [count({ created: 0 })] },
  ],
  months: [{ year: 2030, month: 2, created: 3 }],
  totals: { created: 3, existing: 2, conflict: 1, past: 0 },
  conflicts: [{ patternKey: MON, date: "2030-02-11", conflict: "Lớp Toán (17:30–18:30)" }],
}
const EMPTY = { patterns: [], months: [{ year: 2030, month: 2, created: 0 }], totals: { created: 0, existing: 0, conflict: 0, past: 0 }, conflicts: [] }

function renderDialog() {
  const props = { open: true, onOpenChange: vi.fn(), initialYear: 2030, initialMonth: 1, onViewMonth: vi.fn() }
  const ui = () => (
    <LanguageProvider forcedLanguage="vi">
      <CopyMonthDialog {...props} />
    </LanguageProvider>
  )
  const { rerender } = render(ui())
  return { ...props, rerender: () => rerender(ui()) }
}
const confirmBtn = () => screen.getByTestId("copy-confirm") as HTMLButtonElement
const boxes = () => screen.getAllByRole("checkbox")

beforeEach(() => {
  vi.clearAllMocks()
  h.allowed = true
  h.ready = true
  h.error = null
  h.preview = PREVIEW
  h.inputs = []
  h.opts = []
  h.mutOpts = null
})
afterEach(() => {
  vi.useRealTimers()
})

describe("CopyMonthDialog", () => {
  it("mở: nguồn = tháng đang xem (kể cả ngoài khoảng chọn), từ = tháng sau, 1 tháng; lần đầu không gửi patternKeys", () => {
    renderDialog()
    expect(h.inputs.at(-1)).toEqual({ source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1 })
    expect(screen.getByTestId("copy-source").textContent).toContain("Tháng 1 / 2030")
    expect(screen.getByTestId("copy-from").textContent).toContain("Tháng 2 / 2030")
    expect(screen.getByTestId("copy-months-1").getAttribute("aria-checked")).toBe("true")
    expect(screen.getByTestId("copy-total").textContent).toBe("Sẽ tạo 3 ca")
    expect(screen.getByText("2 ca đã có, bỏ qua")).toBeTruthy()
    expect(screen.getByText("1 ca trùng giờ, bỏ qua")).toBeTruthy()
    expect(screen.queryByText(/ngày đã qua/)).toBeNull()
    expect(screen.getByText("Tháng 2 / 2030: 3 ca")).toBeTruthy()
    expect(confirmBtn().textContent).toContain("Tạo 3 ca")
    expect(confirmBtn().disabled).toBe(false)
  })

  it("mẫu regular tích sẵn, stopped/single không; pill loại, ngày dừng, HS bị bỏ, danh sách trùng giờ", () => {
    renderDialog()
    expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "false", "false"])
    expect(screen.getByText("Không còn dạy sau 08/01")).toBeTruthy()
    expect(screen.getByText("Chỉ 1 buổi trong tháng")).toBeTruthy()
    expect(screen.getAllByTestId("copy-pattern")[0].textContent).toContain("bỏ 1 HS đã nghỉ")
    fireEvent.click(screen.getByRole("button", { name: "Trùng giờ 1 ca" }))
    expect(screen.getByText("11/02: Lớp Toán (17:30–18:30)")).toBeTruthy()
  })

  it("tích thêm → nút Tạo khóa tới khi xem trước gọi lại (300ms) với patternKeys; bấm Tạo gửi đúng key", () => {
    vi.useFakeTimers()
    renderDialog()
    fireEvent.click(boxes()[2])
    expect(confirmBtn().disabled).toBe(true)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(h.inputs.at(-1)).toEqual({ source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1, patternKeys: [MON, SAT] })
    expect(confirmBtn().disabled).toBe(false)
    fireEvent.click(confirmBtn())
    expect(h.mutate).toHaveBeenCalledWith({ source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1, patternKeys: [MON, SAT] })
  })

  it("chọn 3 tháng → gửi months 3, tóm tắt khoảng tháng", () => {
    renderDialog()
    fireEvent.click(screen.getByTestId("copy-months-3"))
    expect(screen.getByTestId("copy-months-3").getAttribute("aria-checked")).toBe("true")
    expect(h.inputs.at(-1)).toMatchObject({ months: 3 })
    expect(screen.getByText("Tháng 2 / 2030 → Tháng 4 / 2030")).toBeTruthy()
  })

  it("tháng nguồn rỗng → trạng thái rỗng, nút Tạo khóa", () => {
    h.preview = EMPTY
    renderDialog()
    expect(screen.getByTestId("copy-empty").textContent).toBe("Tháng 1 / 2030 chưa có ca nào để chép")
    expect(confirmBtn().disabled).toBe(true)
  })

  it("chưa đủ gói → không gọi xem trước (enabled=false), nút Tạo khóa", () => {
    h.allowed = false
    renderDialog()
    expect(h.opts.every((o) => o.enabled === false)).toBe(true)
    expect(confirmBtn().disabled).toBe(true)
  })

  it("tạo xong → bước kết quả; Xem tháng chuyển lịch sang tháng đầu và đóng", () => {
    const props = renderDialog()
    act(() => {
      h.mutOpts?.onSuccess?.({ created: 3, months: [{ year: 2030, month: 2, created: 3 }], skipped: { existing: 2, conflict: 1, past: 0 } })
    })
    expect(screen.getByTestId("copy-result").textContent).toContain("Đã tạo 3 ca")
    expect(screen.getByTestId("copy-result").textContent).toContain("2 ca đã có, bỏ qua")
    fireEvent.click(screen.getByRole("button", { name: "Xem Tháng 2 / 2030" }))
    expect(props.onViewMonth).toHaveBeenCalledWith(2030, 2)
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("lỗi gói ở mutation → đóng dialog; lỗi khác → ở lại", () => {
    const props = renderDialog()
    act(() => {
      h.mutOpts?.onError?.({ message: "Quá nhiều ca, hãy chọn ít tháng hơn", data: { planRequired: null } })
    })
    expect(props.onOpenChange).not.toHaveBeenCalled()
    act(() => {
      h.mutOpts?.onError?.({ message: "Tính năng này cần gói Plus", data: { planRequired: "plus" } })
    })
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("xem trước lỗi không phải gói → hiện lỗi + Thử lại thay skeleton; bấm gọi refetch", () => {
    h.error = { message: "Lỗi máy chủ", data: { code: "INTERNAL_SERVER_ERROR", planRequired: null } }
    renderDialog()
    expect(screen.getByText("Lỗi máy chủ")).toBeTruthy()
    expect(document.querySelector("[data-testid=copy-preview] .animate-pulse")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(h.refetch).toHaveBeenCalled()
  })

  it("mutation lỗi không phải gói → xem trước tự gọi lại", () => {
    renderDialog()
    act(() => {
      h.mutOpts?.onError?.({ message: "Quá nhiều ca, hãy chọn ít tháng hơn", data: { code: "BAD_REQUEST", planRequired: null } })
    })
    expect(h.refetch).toHaveBeenCalled()
  })

  it("mở lúc gói chưa tải, sau đó gói không đủ → mở nâng cấp và đóng dialog", () => {
    h.allowed = false
    h.ready = false
    const props = renderDialog()
    expect(h.openUpgrade).not.toHaveBeenCalled()
    h.ready = true
    props.rerender()
    expect(h.openUpgrade).toHaveBeenCalled()
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("tổng ca vượt giới hạn → khoá nút Tạo + gợi ý", () => {
    h.preview = { ...PREVIEW, totals: { ...PREVIEW.totals, created: 325 } }
    renderDialog()
    expect(confirmBtn().disabled).toBe(true)
    expect(screen.getByText("Tối đa 300 ca mỗi lần — bỏ bớt mẫu hoặc chọn ít tháng hơn")).toBeTruthy()
  })
})
