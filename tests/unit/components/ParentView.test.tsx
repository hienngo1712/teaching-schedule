/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ParentView } from "@/components/parent/ParentView"
import type { ParentViewDTO } from "@/lib/types/models"

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,x"),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/p/token123",
}))

const baseView: ParentViewDTO = {
  student: { fullName: "Nguyễn Văn Test", grade: 5 },
  year: 2026,
  month: 5,
  prevMonth: "2026-04",
  nextMonth: "2026-06",
  attendance: [
    { date: "2026-05-04", startTime: "08:00", endTime: "09:30", subjectName: "Toán", attendance: "present" },
    { date: "2026-05-11", startTime: "08:00", endTime: "09:30", subjectName: "Toán", attendance: "late" },
    { date: "2026-05-18", startTime: "08:00", endTime: "09:30", subjectName: "Toán", attendance: "absent" },
  ],
  upcoming: [],
  notice: {
    studentId: 1,
    fullName: "Nguyễn Văn Test",
    grade: 5,
    year: 2026,
    month: 5,
    totalSessions: 3,
    presentSessions: 2,
    billingMode: "per_session",
    monthlyFee: 0,
    currentMonthFee: 200000,
    previousBalance: 0,
    totalAmountDue: 200000,
    paidAmount: 0,
    isFullPaid: false,
    presentDates: [{ date: "2026-05-04", fee: 100000 }, { date: "2026-05-11", fee: 100000 }],
    payments: [],
    remaining: 200000,
    overpaid: 0,
    inProgress: false,
    debtMonths: 0,
    teacherName: "Giáo viên A",
    bankConfigured: true,
    qr: null,
  },
}

describe("ParentView - layout 2 cột desktop (spec Y Task 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("desktop (matchMedia true) -> variant wide, lg:max-w-6xl, 3 ô parent-stat", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("1024px"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <ParentView view={baseView} />
      </LanguageProvider>
    )

    // Khung ngoài có lg:max-w-6xl
    expect(container.querySelector(".lg\\:max-w-6xl")).toBeDefined()

    // 3 ô tóm tắt parent-stat
    const stats = screen.getAllByTestId("parent-stat")
    expect(stats).toHaveLength(3)
    // Có mặt = 2 (present + late)
    expect(stats[0].textContent).toContain("2")
    expect(stats[0].textContent).toContain("Có mặt")
    // Vắng = 1 (absent)
    expect(stats[1].textContent).toContain("1")
    expect(stats[1].textContent).toContain("Vắng")
    // Tổng buổi = 3
    expect(stats[2].textContent).toContain("3")
    expect(stats[2].textContent).toContain("Tổng buổi")

    // Phiếu hiển thị bản wide (width full)
    const card = screen.getByTestId("notice-card")
    expect(card.className).toContain("w-full")
  })

  it("điện thoại giữ như cũ: 3 ô tóm tắt chỉ hiện từ lg, dòng 'Có mặt n/total buổi' hiện dưới lg", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    render(
      <LanguageProvider forcedLanguage="vi">
        <ParentView view={baseView} />
      </LanguageProvider>
    )

    const statsGrid = screen.getAllByTestId("parent-stat")[0].parentElement!
    expect(statsGrid.className).toContain("hidden")
    expect(statsGrid.className).toContain("lg:grid")
    const summary = screen.getByText("Có mặt 2/3 buổi")
    expect(summary.className).toContain("lg:hidden")
  })
})

describe("ParentView: QR payOS (spec AH §5)", () => {
  it("trang PH: có nút 'Mở trang thanh toán' trỏ checkoutUrl, mở tab mới", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    render(
      <LanguageProvider forcedLanguage="vi">
        <ParentView view={{ ...baseView, notice: { ...baseView.notice, qr: { provider: "payos" as const, payload: "QR1", bankShortName: "MB", accountNumber: "0001", accountName: "GV A", amount: 200000, content: "HP 1", checkoutUrl: "https://pay/1" } } }} />
      </LanguageProvider>
    )
    const link = screen.getByRole("link", { name: /Mở trang thanh toán/ })
    expect(link.getAttribute("href")).toBe("https://pay/1")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(link.className).toContain("h-11")
  })
  it("trang PH: QR VietQR không có nút Mở trang thanh toán", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <ParentView view={{ ...baseView, notice: { ...baseView.notice, qr: { ...{ provider: "payos" as const, payload: "QR1", bankShortName: "MB", accountNumber: "0001", accountName: "GV A", amount: 200000, content: "HP 1", checkoutUrl: "https://pay/1" }, provider: "vietqr", checkoutUrl: null } } }} />
      </LanguageProvider>
    )
    expect(screen.queryByRole("link", { name: /Mở trang thanh toán/ })).toBeNull()
  })
})
