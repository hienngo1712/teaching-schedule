/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ParentView } from "@/components/parent/ParentView"
import { vnDateParts } from "@/lib/utils"
import type { ParentViewDTO, TuitionNoticeDTO } from "@/lib/types/models"

vi.mock("next/navigation", () => ({ usePathname: () => "/p/tok" }))
// Card của C đã có test riêng; ở đây chỉ kiểm khung trang phụ huynh.
vi.mock("@/components/tuition/TuitionNoticeCard", () => ({
  TuitionNoticeCard: () => <div data-testid="notice-card" />,
}))

function todayVn(): string {
  const { year, month, day } = vnDateParts()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function makeView(over: Partial<ParentViewDTO> = {}): ParentViewDTO {
  return {
    student: { fullName: "Nguyễn Văn An", grade: 5 },
    year: 2026,
    month: 9,
    prevMonth: "2026-08",
    nextMonth: null,
    notice: { teacherName: "Cô Lan", qr: null, payments: [] } as unknown as TuitionNoticeDTO,
    attendance: [
      { date: "2026-09-03", startTime: "17:30", endTime: "19:00", subjectName: "Toán", attendance: "present" },
      { date: "2026-09-05", startTime: "17:30", endTime: "19:00", subjectName: "Toán", attendance: "late" },
      { date: "2026-09-10", startTime: "17:30", endTime: "19:00", subjectName: "Toán", attendance: "absent" },
    ],
    upcoming: [{ date: todayVn(), startTime: "18:00", endTime: "19:30", subjectName: "Toán", attendance: "pending" }],
    ...over,
  }
}

function renderView(view: ParentViewDTO) {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <ParentView view={view} />
    </LanguageProvider>
  )
}

describe("ParentView", () => {
  afterEach(cleanup)

  it("đầu trang, phiếu, tóm tắt có mặt (muộn tính có mặt), dòng điểm danh và nhãn", () => {
    renderView(makeView())
    expect(screen.getByText("Nguyễn Văn An")).toBeTruthy()
    expect(screen.getByText("Lớp 5")).toBeTruthy()
    expect(screen.getByText("Giáo viên: Cô Lan")).toBeTruthy()
    expect(screen.getByTestId("notice-card")).toBeTruthy()
    expect(screen.getByText("Điểm danh tháng 9")).toBeTruthy()
    expect(screen.getByText("Có mặt 2/3 buổi")).toBeTruthy()
    expect(screen.getByText("T5 · 03/09 · 17:30–19:00 · Toán")).toBeTruthy()
    expect(screen.getByText("Có mặt")).toBeTruthy()
    expect(screen.getByText("Muộn")).toBeTruthy()
    expect(screen.getByText("Vắng")).toBeTruthy()
    expect(screen.getByText("Trang chỉ để xem. Có thắc mắc, vui lòng liên hệ giáo viên.")).toBeTruthy()
  })

  it("chọn tháng: tháng trước là link ?thang=, tháng sau ở biên là chữ không có link", () => {
    renderView(makeView())
    expect(screen.getByTestId("parent-month").textContent).toBe("Tháng 9/2026")
    const prev = screen.getByRole("link", { name: /Tháng trước/ })
    expect(prev.getAttribute("href")).toBe("/p/tok?thang=2026-08")
    expect(screen.queryByRole("link", { name: /Tháng sau/ })).toBeNull()
    expect(screen.getByText(/Tháng sau/)).toBeTruthy()
  })

  it("ca hôm nay có huy hiệu 'Hôm nay'", () => {
    renderView(makeView())
    expect(screen.getByText("Hôm nay")).toBeTruthy()
  })

  it("rỗng → thông báo chưa có buổi / chưa có lịch", () => {
    renderView(makeView({ attendance: [], upcoming: [] }))
    expect(screen.getByText("Tháng này chưa có buổi học.")).toBeTruthy()
    expect(screen.getByText("Chưa có lịch học sắp tới.")).toBeTruthy()
    expect(screen.queryByText("Hôm nay")).toBeNull()
  })

  it("có QR → hiện dòng hướng dẫn quét; không QR → không hiện", () => {
    const withQr = makeView({
      notice: { teacherName: "Cô Lan", qr: { payload: "x" }, payments: [] } as unknown as TuitionNoticeDTO,
    })
    renderView(withQr)
    expect(screen.getByText("Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng.")).toBeTruthy()
    cleanup()
    renderView(makeView())
    expect(screen.queryByText("Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng.")).toBeNull()
  })
})
