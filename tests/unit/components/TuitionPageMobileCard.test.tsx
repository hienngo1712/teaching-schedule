/**
 * @vitest-environment jsdom
 */
// Tái hiện bug review #2: onKeyDown của thẻ mobile bắt cả Enter nổi lên từ nút
// "Phiếu báo"/"Ghi nhận" lồng bên trong → mở nhầm sheet chi tiết.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import TuitionPage from "@/app/(app)/tuition/page"
import { formatCurrency } from "@/lib/utils"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))

const item = {
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

const getMonthlyStatusQuery = {
  data: { items: [item], totalCount: 1, totalPages: 1 },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    tuition: {
      getMonthlyStatus: { useQuery: () => getMonthlyStatusQuery },
      getNotice: { useQuery: () => ({ data: undefined, isError: false, refetch: vi.fn() }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      list: { useQuery: () => ({ data: [], isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/tuition")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as ReturnType<typeof useSearchParams>)
  // TuitionDetailSheet/TuitionNoticeDialog dùng useMediaQuery → jsdom không có matchMedia mặc định.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

function renderPage() {
  return render(
    <LanguageProvider>
      <TuitionPage />
    </LanguageProvider>
  )
}

describe("TuitionPage - thẻ mobile", () => {
  it("Enter nổi lên từ nút Phiếu báo lồng bên trong không mở sheet chi tiết", () => {
    renderPage()
    // Bảng (desktop) và thẻ (mobile) cùng render — cả 2 đều có nút "Phiếu báo".
    const btns = screen.getAllByRole("button", { name: "Phiếu báo" })
    const inCard = btns.find((b) => b.closest('[role="button"]'))!
    fireEvent.keyDown(inCard, { key: "Enter", bubbles: true })

    // Sheet chi tiết chỉ render nội dung khi mở (data != null) — tiêu đề sr-only "Chi tiết học phí".
    expect(screen.queryByText("Chi tiết học phí")).toBeNull()
  })

  it("Enter nổi lên từ nút Ghi nhận lồng bên trong không mở sheet 2 lần / không lỗi", () => {
    renderPage()
    const btns = screen.getAllByRole("button", { name: "Ghi nhận" })
    const inCard = btns.find((b) => b.closest('[role="button"]'))!
    fireEvent.keyDown(inCard, { key: "Enter", bubbles: true })

    expect(screen.queryByText("Chi tiết học phí")).toBeNull()
  })

  it("Enter trực tiếp trên thẻ (currentTarget) vẫn mở sheet chi tiết như cũ", () => {
    renderPage()
    const cards = screen.getAllByRole("button", { name: /Nguyễn Văn A/ })
    // Thẻ mobile là div role=button chứa tên HS trực tiếp trong text.
    const card = cards.find((el) => el.tagName === "DIV")!
    fireEvent.keyDown(card, { key: "Enter", bubbles: true })

    expect(screen.queryAllByText("Chi tiết học phí").length).toBeGreaterThan(0)
  })
})

describe("TuitionPage - màu thẻ mobile", () => {
  afterEach(() => {
    getMonthlyStatusQuery.data.items = [item]
  })

  function cardAmount(value: number) {
    return screen
      .getAllByText(formatCurrency(value))
      .find((el) => el.tagName === "DIV" && el.closest('[role="button"]'))!
  }

  function cardPayButton() {
    return screen.getAllByRole("button", { name: "Ghi nhận" }).find((b) => b.closest('[role="button"]'))!
  }

  it("chưa đóng → số tiền đỏ nợ 17px, nút Ghi nhận nền màu nhấn", () => {
    renderPage()
    const amount = cardAmount(400000)
    expect(amount.className).toContain("text-debt")
    expect(amount.className).toContain("text-[17px]")
    expect(amount.className).toContain("tabular-nums")
    expect(cardPayButton().className).toContain("bg-primary")
  })

  it("đóng một phần → số tiền chữ chính", () => {
    getMonthlyStatusQuery.data.items = [{ ...item, paidAmount: 100000 }]
    renderPage()
    expect(cardAmount(400000).className).toContain("text-foreground")
  })

  it("đã đóng đủ → số tiền chữ phụ, nút Ghi nhận viền (outline)", () => {
    getMonthlyStatusQuery.data.items = [{ ...item, paidAmount: 400000 }]
    renderPage()
    expect(cardAmount(400000).className).toContain("text-muted-foreground")
    const btn = cardPayButton().className
    expect(btn).toContain("border-input")
    expect(btn).not.toContain("bg-primary")
  })
})
