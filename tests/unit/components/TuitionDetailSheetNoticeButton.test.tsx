/**
 * @vitest-environment jsdom
 */
// Review #6: nút "Phiếu báo" bấm được khi đang có sửa đổi tất toán chưa lưu (form dirty)
// → phải disable khi dirty, dùng biến dirty đã có trong TuitionDetailBody.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"
import { UpgradeDialog } from "@/components/plan/UpgradeDialog"

const row = {
  studentId: 1,
  fullName: "Nguyễn Văn A",
  grade: 5,
  totalSessions: 4,
  presentSessions: 4,
  totalExpected: 400000,
  paidAmount: 0,
  isFullPaid: false,
  notes: null,
  previousBalance: 0,
  totalAmountDue: 400000,
}

const mockCalls = vi.hoisted(() => ({ list: [] as unknown[] }))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    tuition: {
      getMonthlyStatus: { useQuery: () => ({ data: { items: [row] }, isPending: false }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      list: {
        useQuery: (...args: unknown[]) => {
          mockCalls.list.push(args[1])
          return { data: [], isPending: false }
        },
      },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

function renderSheet() {
  return render(
    <LanguageProvider>
      <TuitionDetailSheet open data={{ ...row, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
    </LanguageProvider>
  )
}

describe("TuitionDetailSheet - nút Phiếu báo", () => {
  it("chưa sửa gì (không dirty) → nút Phiếu báo bấm được", () => {
    renderSheet()
    const btn = screen.getByRole("button", { name: "Phiếu báo" })
    expect(btn.hasAttribute("disabled")).toBe(false)
  })

  it("đang sửa tất toán chưa lưu (dirty) → nút Phiếu báo bị disable", () => {
    renderSheet()
    fireEvent.click(screen.getByRole("checkbox"))
    const btn = screen.getByRole("button", { name: "Phiếu báo" })
    expect(btn.hasAttribute("disabled")).toBe(true)
  })
})

describe("TuitionDetailSheet - màu nợ", () => {
  it("còn phải trả > 0 → dòng còn lại dùng đỏ nợ", () => {
    renderSheet()
    expect(screen.getByTestId("remaining-line").className).toContain("text-debt")
  })
})

describe("TuitionDetailSheet - Standard (paymentsLocked)", () => {
  it("vẫn xem phần tính tiền; lịch sử thu + tất toán khóa; bấm Phiếu báo mở popup Plus; không gọi payment.list", async () => {
    mockCalls.list.length = 0
    render(
      <LanguageProvider>
        <TuitionDetailSheet open paymentsLocked data={{ ...row, year: 2026, month: 5 }} onOpenChange={() => {}} onSuccess={() => {}} />
        <UpgradeDialog />
      </LanguageProvider>
    )
    expect(screen.getByText("Tổng tiền cần đóng")).toBeTruthy()
    expect(screen.getByTestId("payments-locked")).toBeTruthy()
    expect(screen.getByTestId("settlement-locked")).toBeTruthy()
    expect(mockCalls.list.every((opts) => (opts as { enabled?: boolean })?.enabled === false)).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: /Phiếu báo/ }))
    expect(await screen.findByText("Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.")).toBeTruthy()
  })
})
