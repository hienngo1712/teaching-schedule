/**
 * @vitest-environment jsdom
 */
// Spec AM §4.1: tab Bảng công (4 ô, nhãn ca bù/huỷ, dòng ca chưa gắn nơi, khoá gói), tab Thu nhập (trống), hộp ghi nhận.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const state = vi.hoisted(() => ({
  timesheet: undefined as unknown,
  income: [] as unknown[],
  locked: false,
  createMutate: vi.fn(),
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ income: { invalidate: vi.fn() } }),
    timesheet: { month: { useQuery: () => ({ data: state.timesheet, isPending: false, isError: false, isSuccess: true }) } },
    income: {
      month: { useQuery: () => ({ data: state.income, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() }) },
      detail: { useQuery: () => ({ data: undefined, isPending: true }) },
    },
    placePayment: {
      create: { useMutation: () => ({ mutate: state.createMutate, isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))
vi.mock("@/hooks/usePlaceSummary", () => ({
  usePlaceSummary: () => ({ places: [{ id: 2, name: "TT Ánh Dương", color: "#0891B2", billing: "per_session" }] }),
}))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({ locked: state.locked, allowed: !state.locked, requiredPlan: "plus", openUpgrade: vi.fn(), guard: (fn: () => void) => fn }),
}))
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }))
vi.mock("@/hooks/useExport", () => ({ useExport: () => ({ captureElement: vi.fn(), isCapturing: false }) }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { fullName: "Nguyễn Thu Hà" } } }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TimesheetTab } from "@/components/timesheet/TimesheetTab"
import { IncomeTab } from "@/components/timesheet/IncomeTab"
import { PlacePaymentDialog } from "@/components/timesheet/PlacePaymentDialog"

const wrap = (ui: React.ReactNode) => render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)

const s = (id: number, over: Record<string, unknown>) => ({
  id,
  date: `2026-09-0${id}`,
  start: "08:00",
  end: "09:30",
  hours: 1.5,
  subject: "Toán 8",
  title: null,
  presentCount: 5,
  totalCount: 5,
  kind: "done",
  isMakeup: false,
  ...over,
})

beforeEach(() => {
  state.locked = false
  state.createMutate.mockReset()
  state.timesheet = {
    place: { id: 2, name: "TT Ánh Dương", color: "#0891B2" },
    stats: { doneCount: 3, doneHours: 4.5, makeupCount: 1, cancelledCount: 1, cancelledHours: 1.5, scheduledCount: 5 },
    sessions: [
      s(1, {}),
      s(2, { kind: "cancelled", cancelReason: "Nghỉ lễ" }),
      s(3, { isMakeup: true }),
      s(4, {}),
      s(5, { kind: "upcoming" }),
    ],
    unassignedCount: 0,
  }
})

describe("TimesheetTab", () => {
  it("4 ô: Đã dạy (ca · giờ), Trong đó ca bù, Đã huỷ, Tổng đã xếp", () => {
    wrap(<TimesheetTab year={2026} month={9} period={null} />)
    const cards = screen.getAllByTestId("stat-card").map((c) => c.textContent)
    expect(cards).toEqual([
      expect.stringMatching(/Đã dạy.*3 ca.*4,5 giờ/),
      expect.stringMatching(/Trong đó ca bù.*1 ca/),
      expect.stringMatching(/Đã huỷ.*1 ca.*Không tính công/),
      expect.stringMatching(/Tổng đã xếp.*5 ca/),
    ])
  })

  it("nhãn Ca bù / Đã huỷ (kèm lý do) / Sắp dạy; không có dòng ca chưa gắn nơi khi = 0", () => {
    wrap(<TimesheetTab year={2026} month={9} period={null} />)
    expect(screen.getAllByText("Ca bù").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Sắp dạy").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Nghỉ lễ").length).toBeGreaterThan(0)
    expect(screen.queryByTestId("ts-unassigned")).toBeNull()
  })

  it("có ca chưa gắn nơi → dòng nhắc, bấm mở lịch đúng tháng", () => {
    state.timesheet = { ...(state.timesheet as object), unassignedCount: 3 }
    wrap(<TimesheetTab year={2026} month={9} period={null} />)
    const banner = screen.getByTestId("ts-unassigned")
    expect(banner.textContent).toContain("3 ca chưa gắn nơi dạy")
    expect(banner.querySelector("a")?.getAttribute("href")).toBe("/calendar?year=2026&month=9")
  })

  it("gói Standard: bảng mờ + khoá", () => {
    state.locked = true
    wrap(<TimesheetTab year={2026} month={9} period={null} />)
    expect(screen.getByTestId("timesheet-locked")).toBeTruthy()
  })
})

describe("IncomeTab", () => {
  it("không nơi nào có đơn giá → empty state + nút mở Nơi dạy", () => {
    state.income = []
    wrap(<IncomeTab year={2026} month={9} period={null} />)
    const empty = screen.getByTestId("income-empty")
    expect(empty.textContent).toContain("Nhập đơn giá ở Nơi dạy để xem thu nhập")
    expect(empty.querySelector("a")?.getAttribute("href")).toBe("/places")
  })

  it("dòng nhận một phần hiện còn thiếu", () => {
    state.income = [
      { placeId: 2, name: "TT Ánh Dương", color: "#0891B2", unit: "hour", amount: 185000, doneCount: 2, doneHours: 3, expected: 555000, received: 500000, status: "partial" },
    ]
    wrap(<IncomeTab year={2026} month={9} period={null} />)
    expect(screen.getAllByText("Nhận một phần").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Còn thiếu 55.000 đ").length).toBeGreaterThan(0)
  })
})

describe("PlacePaymentDialog", () => {
  it("số tiền mặc định = còn thiếu; Ghi nhận gửi đúng", async () => {
    wrap(<PlacePaymentDialog placeId={2} placeName="TT Ánh Dương" year={2026} month={9} remaining={55000} onClose={() => {}} />)
    expect((screen.getByLabelText("Số tiền đã nhận") as HTMLInputElement).value).toBe("55,000")
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận đã nhận" }))
    await waitFor(() => expect(state.createMutate).toHaveBeenCalledTimes(1))
    expect(state.createMutate.mock.calls[0][0]).toMatchObject({ placeId: 2, year: 2026, month: 9, amount: 55000 })
  })
})
