/**
 * @vitest-environment jsdom
 */
// Trang phụ huynh bố cục mới (spec AU A): nhận xét / thanh toán / điểm danh chip / lịch thu gọn.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ParentView } from "@/components/parent/ParentView"
import type { ParentSessionDTO, ParentViewDTO, TuitionNoticeDTO } from "@/lib/types/models"

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,x"),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/p/token123",
}))

const QR: NonNullable<TuitionNoticeDTO["qr"]> = {
  provider: "vietqr", checkoutUrl: null, payload: "QR1", bankShortName: "MB", accountNumber: "0001",
  accountName: "GV A", amount: 200000, content: "HP 1",
}

const notice: TuitionNoticeDTO = {
  studentId: 0, fullName: "Nguyễn Văn Test", grade: 5, year: 2026, month: 5, totalSessions: 3, presentSessions: 2,
  billingMode: "per_session", monthlyFee: 0, currentMonthFee: 200000, previousBalance: 0, totalAmountDue: 200000,
  paidAmount: 0, isFullPaid: false,
  presentDates: [{ date: "2026-05-04", fee: 100000 }, { date: "2026-05-11", fee: 100000 }],
  payments: [], remaining: 200000, overpaid: 0, inProgress: false, debtMonths: 0, teacherName: "Giáo viên A",
  bankConfigured: true, parentComment: null, qr: QR,
}

const s = (date: string, attendance: ParentSessionDTO["attendance"]): ParentSessionDTO => ({
  date, startTime: "08:00", endTime: "09:30", subjectName: "Toán", attendance,
})

const baseView: ParentViewDTO = {
  student: { fullName: "Nguyễn Văn Test", grade: 5 },
  teacherName: "Giáo viên A",
  year: 2026, month: 5, prevMonth: "2026-04", nextMonth: "2026-06",
  attendance: [s("2026-05-04", "present"), s("2026-05-11", "late"), s("2026-05-18", "absent")],
  upcoming: [],
  notice,
}

const renderView = (view: ParentViewDTO) =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <ParentView view={view} />
    </LanguageProvider>
  )

let ioCallbacks: ((entries: { target: Element; isIntersecting: boolean }[]) => void)[] = []
let observed: Element[] = []

beforeEach(() => {
  vi.clearAllMocks()
  ioCallbacks = []
  observed = []
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
  // IntersectionObserver giả: lưu callback để test tự bắn.
  window.IntersectionObserver = class {
    constructor(cb: (typeof ioCallbacks)[number]) {
      ioCallbacks.push(cb)
    }
    observe(el: Element) {
      observed.push(el)
    }
    disconnect() {}
    unobserve() {}
  } as unknown as typeof IntersectionObserver
})

describe("ParentView: khối thanh toán (AU A1)", () => {
  it("có tiêu đề + nhãn trạng thái, số Còn phải trả, QR và 3 dòng có nút Sao chép", async () => {
    renderView(baseView)
    const pay = screen.getByTestId("parent-pay")
    expect(within(pay).getByText("Học phí tháng 5")).toBeTruthy()
    expect(within(pay).getByText("Chưa đóng")).toBeTruthy()
    expect(within(pay).getByTestId("parent-pay-remaining").textContent).toContain("200.000")
    await waitFor(() => expect(within(pay).getByAltText("VietQR")).toBeTruthy())
    expect(within(pay).getAllByRole("button", { name: /Sao chép/ })).toHaveLength(3)
    expect(within(pay).getByText("MB · GV A")).toBeTruthy()
  })

  it("bấm Sao chép → chép số TK / số tiền (số thuần) / nội dung", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderView(baseView)
    const [acc, amount, content] = within(screen.getByTestId("parent-pay")).getAllByRole("button", { name: /Sao chép/ })
    fireEvent.click(acc)
    fireEvent.click(amount)
    fireEvent.click(content)
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(3))
    expect(writeText.mock.calls.map((c) => c[0])).toEqual(["0001", "200000", "HP 1"])
    await waitFor(() => expect(screen.getAllByText("Đã chép").length).toBeGreaterThan(0))
  })

  it("không có QR → vẫn có số tiền, không có ô QR / nút Sao chép", () => {
    renderView({ ...baseView, notice: { ...notice, qr: null, bankConfigured: false } })
    const pay = screen.getByTestId("parent-pay")
    expect(within(pay).getByTestId("parent-pay-remaining").textContent).toContain("200.000")
    expect(within(pay).queryByRole("img")).toBeNull()
    expect(within(pay).queryByRole("button", { name: /Sao chép/ })).toBeNull()
  })

  it("payOS: có nút Mở trang thanh toán trỏ checkoutUrl, mở tab mới, cao ≥ 44px", () => {
    renderView({ ...baseView, notice: { ...notice, qr: { ...QR, provider: "payos", checkoutUrl: "https://pay/1" } } })
    const link = screen.getByRole("link", { name: /Mở trang thanh toán/ })
    expect(link.getAttribute("href")).toBe("https://pay/1")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(link.className).toContain("h-11")
  })

  it("VietQR không có nút Mở trang thanh toán", () => {
    renderView(baseView)
    expect(screen.queryByRole("link", { name: /Mở trang thanh toán/ })).toBeNull()
  })

  it("đã đóng đủ → nhãn Đã đóng đủ, không có thẻ tiền đầu trang", () => {
    renderView({ ...baseView, notice: { ...notice, paidAmount: 200000, remaining: 0, qr: null } })
    expect(within(screen.getByTestId("parent-pay")).getAllByText(/Đã đóng đủ|Đã thanh toán đủ/).length).toBeGreaterThan(0)
    expect(screen.queryByTestId("parent-summary")).toBeNull()
  })

  it("nợ nhiều tháng → từng tháng + Tổng nợ cũ (spec AU B)", () => {
    renderView({
      ...baseView,
      notice: {
        ...notice, previousBalance: 480000, totalAmountDue: 680000, remaining: 680000, debtMonths: 2,
        debtBreakdown: [{ year: 2026, month: 3, amount: 200000 }, { year: 2026, month: 4, amount: 280000 }],
      },
    })
    const pay = screen.getByTestId("parent-pay")
    expect(within(pay).getByText("Tháng 3 còn thiếu")).toBeTruthy()
    expect(within(pay).getByText("Tháng 4 còn thiếu")).toBeTruthy()
    expect(within(pay).getByText("Tổng nợ cũ")).toBeTruthy()
  })

  it("HS ở nơi tính theo ca (notice null) → không có khối thanh toán, thẻ tiền, nhận xét", () => {
    renderView({ ...baseView, notice: null })
    expect(screen.queryByTestId("parent-pay")).toBeNull()
    expect(screen.queryByTestId("parent-summary")).toBeNull()
    expect(screen.queryByTestId("parent-comment")).toBeNull()
  })
})

describe("ParentView: thứ tự + nhận xét (AU A1, A2)", () => {
  it("thứ tự DOM (điện thoại): thẻ tiền → nhận xét → thanh toán → điểm danh → lịch; web: thanh toán cột phải, sticky", () => {
    renderView({ ...baseView, notice: { ...notice, parentComment: "Con ngoan." } })
    const ids = ["parent-summary", "parent-comment", "parent-pay", "parent-attendance", "parent-upcoming"].map((id) => screen.getByTestId(id))
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i - 1].compareDocumentPosition(ids[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(ids[0].className).toContain("lg:hidden")
    const pay = ids[2]
    expect(pay.className).toContain("lg:sticky")
    expect(pay.className).toContain("lg:col-start-2")
  })

  it("thẻ tiền đầu trang: 'Còn phải trả tháng 5' + nút Mã QR ↓ cuộn tới khối thanh toán", () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderView(baseView)
    const summary = screen.getByTestId("parent-summary")
    expect(summary.textContent).toContain("Còn phải trả tháng 5")
    fireEvent.click(within(summary).getByRole("button", { name: /Mã QR/ }))
    expect(scroll).toHaveBeenCalled()
  })

  it("nhận xét: tiêu đề tháng + tên GV, giữ xuống dòng, chữ thường (không HTML)", () => {
    const { container } = renderView({ ...baseView, notice: { ...notice, parentComment: "Dòng 1\n<b>Dòng 2</b>" } })
    const card = screen.getByTestId("parent-comment")
    expect(card.textContent).toContain("Nhận xét tháng 5")
    expect(card.textContent).toContain("Giáo viên A")
    expect(card.querySelector(".whitespace-pre-wrap")!.textContent).toBe("Dòng 1\n<b>Dòng 2</b>")
    expect(container.querySelector("b")).toBeNull()
  })

  it("không có nhận xét → không có thẻ Nhận xét", () => {
    renderView(baseView)
    expect(screen.queryByTestId("parent-comment")).toBeNull()
  })

  it("nhận xét dài (cao hơn khung thu gọn) → nút Đọc tiếp, bấm thì mở hết", () => {
    const sh = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(500)
    const ch = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(180)
    renderView({ ...baseView, notice: { ...notice, parentComment: "rất dài ".repeat(200) } })
    const text = screen.getByTestId("parent-comment").querySelector(".whitespace-pre-wrap")!
    expect(text.className).toContain("max-h-")
    fireEvent.click(screen.getByRole("button", { name: /Đọc tiếp/ }))
    expect(text.className).not.toContain("max-h-")
    expect(screen.queryByRole("button", { name: /Đọc tiếp/ })).toBeNull()
    sh.mockRestore()
    ch.mockRestore()
  })

  it("thanh dính đáy: chỉ hiện khi đã cuộn qua cả thẻ tiền lẫn khối thanh toán", () => {
    renderView(baseView)
    const bar = screen.getByTestId("parent-sticky-bar")
    expect(bar.className).toContain("translate-y-full")
    const summary = screen.getByTestId("parent-summary")
    const pay = screen.getByTestId("parent-pay")
    act(() => ioCallbacks.forEach((cb) => cb([{ target: summary, isIntersecting: false }, { target: pay, isIntersecting: true }])))
    expect(bar.className).toContain("translate-y-full")
    act(() => ioCallbacks.forEach((cb) => cb([{ target: pay, isIntersecting: false }])))
    expect(bar.className).not.toContain("translate-y-full")
    expect(bar.textContent).toContain("200.000")
    expect(bar.className).toContain("lg:hidden")
  })
})

describe("ParentView: điểm danh chip + lịch thu gọn (AU A3)", () => {
  it("3 ô số Có mặt (gồm muộn) / Vắng / Tổng buổi", () => {
    renderView(baseView)
    const stats = screen.getAllByTestId("parent-stat")
    expect(stats.map((x) => x.textContent)).toEqual(["2Có mặt", "1Vắng", "3Tổng buổi"])
  })

  it("mỗi buổi 1 chip ngày; vắng gạch ngang; danh sách giờ thu vào 'Xem giờ học từng buổi'", () => {
    renderView(baseView)
    const chips = screen.getAllByTestId("parent-chip")
    expect(chips).toHaveLength(3)
    expect(chips[0].textContent).toContain("04/05")
    expect(chips[2].className).toContain("line-through")
    const details = screen.getByText("Xem giờ học từng buổi").closest("details")!
    expect(details.textContent).toContain("08:00–09:30")
  })

  it("lịch sắp tới: hiện 3 buổi, còn lại thu vào 'Xem thêm N buổi'", () => {
    const upcoming = ["2026-06-01", "2026-06-03", "2026-06-05", "2026-06-08", "2026-06-10"].map((d) => s(d, "pending"))
    renderView({ ...baseView, upcoming })
    const sec = screen.getByTestId("parent-upcoming")
    const details = within(sec).getByText("Xem thêm 2 buổi").closest("details")!
    expect(within(details).getAllByRole("listitem")).toHaveLength(2)
    expect(within(sec).getAllByRole("listitem")).toHaveLength(5)
  })

  it("ít hơn hoặc bằng 3 buổi → không có Xem thêm", () => {
    renderView({ ...baseView, upcoming: [s("2026-06-01", "pending")] })
    expect(screen.queryByText(/Xem thêm/)).toBeNull()
  })

  it("tháng không có buổi → báo không có buổi", () => {
    renderView({ ...baseView, attendance: [] })
    expect(screen.getByText("Tháng này chưa có buổi học.")).toBeTruthy()
  })
})
