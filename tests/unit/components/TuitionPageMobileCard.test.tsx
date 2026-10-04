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

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: undefined, ready: true, fields: null, has: () => true }),
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
  billingMode: "per_session" as const,
  monthlyFee: 0,
  noticeSentAt: null,
  noticeSentAmount: null,
  noticeStatus: "none" as const,
  inProgress: false,
  debtMonths: 0,
}

const getMonthlyStatusQuery = {
  data: { items: [item], totalCount: 1, totalPages: 1 },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tuition: { getMonthlyStatus: { invalidate: vi.fn() } } }),
    tuition: {
      getMonthlyStatus: { useQuery: () => getMonthlyStatusQuery },
      getNotice: { useQuery: () => ({ data: undefined, isError: false, refetch: vi.fn() }) },
      ledgers: { useQuery: () => ({ data: [], isPending: false }) },
      updateSettlement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    payment: {
      list: { useQuery: () => ({ data: [], isPending: false }) },
      listBatches: { useQuery: () => ({ data: [], isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteBatch: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      record: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
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

  it("Enter nổi lên từ nút Đã đóng đủ lồng bên trong không mở sheet 2 lần / không lỗi", () => {
    renderPage()
    // Nút desktop không nằm trong card, chỉ tìm nút trong thẻ mobile
    const cards = screen.getAllByRole("button", { name: /Nguyễn Văn A/ }).filter((el) => el.tagName === "DIV")
    const inCard = cards[0].querySelector("button:not([aria-label='Phiếu báo'])")!
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

describe("TuitionPage - nút Đã đóng đủ thẻ mobile", () => {
  afterEach(() => {
    getMonthlyStatusQuery.data.items = [item]
  })

  it("due > 0 → có nút Đã đóng đủ 400.000 đ", () => {
    renderPage()
    const btns = screen.getAllByRole("button", { name: "Đã đóng đủ 400.000 đ" })
    expect(btns.length).toBeGreaterThan(0)
  })

  it("due === 0 → không có nút Đã đóng đủ", () => {
    getMonthlyStatusQuery.data = {
      items: [{ ...item, paidAmount: 400000 }],
      totalCount: 1,
      totalPages: 1,
    }
    renderPage()
    const btns = screen.queryAllByRole("button")
    const payBtn = btns.find((b) => b.tagName === "BUTTON" && b.textContent?.includes("Đã đóng đủ"))
    expect(payBtn).toBeUndefined()
  })
})

describe("TuitionPage - số tiền to trên thẻ mobile (spec Y §4.1)", () => {
  afterEach(() => {
    getMonthlyStatusQuery.data = { items: [item], totalCount: 1, totalPages: 1 }
  })

  function cardAmount(text: string) {
    return screen.getAllByText(text).find((el) => el.tagName === "SPAN" && el.closest('[role="button"]'))!
  }

  it("chưa đóng → số cần đóng đỏ nợ, 17px", () => {
    renderPage()
    const amount = cardAmount("400.000 đ")
    expect(amount.className).toContain("text-debt")
    expect(amount.className).toContain("text-[17px]")
  })

  it("đóng một phần → chữ chính", () => {
    getMonthlyStatusQuery.data = { items: [{ ...item, paidAmount: 100000 }], totalCount: 1, totalPages: 1 }
    renderPage()
    expect(cardAmount("300.000 đ").className).toContain("text-foreground")
  })

  it("đã đóng đủ → 0 đ chữ phụ", () => {
    getMonthlyStatusQuery.data = { items: [{ ...item, paidAmount: 400000 }], totalCount: 1, totalPages: 1 }
    renderPage()
    expect(cardAmount("0 đ").className).toContain("text-muted-foreground")
  })
})
