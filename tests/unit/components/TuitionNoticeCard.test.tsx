/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import type { TuitionNoticeDTO } from "@/lib/types/models"

// Mock qrcode toDataURL
vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,x"),
}))

const baseNotice: TuitionNoticeDTO = {
  studentId: 1,
  fullName: "Nguyễn Văn Test",
  grade: 5,
  year: 2026,
  month: 5,
  totalSessions: 2,
  presentSessions: 1,
  billingMode: "monthly",
  monthlyFee: 400000,
  currentMonthFee: 400000,
  previousBalance: 0,
  totalAmountDue: 400000,
  paidAmount: 0,
  isFullPaid: false,
  presentDates: [{ date: "2026-05-04", fee: 0 }],
  payments: [],
  remaining: 400000,
  overpaid: 0,
  teacherName: "Giáo viên A",
  bankConfigured: false,
  qr: null,
}

describe("TuitionNoticeCard: hiển thị học phí trọn tháng vs theo buổi (Plan T)", () => {
  it("HS trọn tháng hiện dòng 'Học phí tháng (trọn gói): ... · Đã học 1/2 buổi' và không hiện học phí/buổi", () => {
    render(
      <LanguageProvider>
        <TuitionNoticeCard notice={baseNotice} />
      </LanguageProvider>
    )

    // Hiện text trọn gói
    expect(screen.getByText(/Học phí tháng \(trọn gói\):.*400\.000.*Đã học 1\/2 buổi/)).toBeTruthy()

    // Không hiện dòng "Học phí/buổi"
    expect(screen.queryByText(viText.notice_fee_per_session)).toBeNull()
    // Không hiện dòng "Số buổi có mặt" riêng lẻ
    expect(screen.queryByText(viText.notice_present_sessions)).toBeNull()

    // Danh sách ngày có mặt không chứa số tiền từng buổi
    expect(screen.getByText("04/05")).toBeTruthy()
    expect(screen.queryByText(/\(0 đ\)/)).toBeNull()
  })

  it("HS theo buổi hiện đầy đủ Số buổi có mặt và Học phí/buổi", () => {
    const perSessionNotice: TuitionNoticeDTO = {
      ...baseNotice,
      billingMode: "per_session",
      monthlyFee: 0,
      totalSessions: 2,
      presentSessions: 2,
      currentMonthFee: 100000,
      presentDates: [
        { date: "2026-05-04", fee: 50000 },
        { date: "2026-05-11", fee: 50000 },
      ],
    }

    render(
      <LanguageProvider>
        <TuitionNoticeCard notice={perSessionNotice} />
      </LanguageProvider>
    )

    // Hiện "Số buổi có mặt"
    expect(screen.getByText(viText.notice_present_sessions)).toBeTruthy()
    // Hiện "Học phí/buổi"
    expect(screen.getByText(viText.notice_fee_per_session)).toBeTruthy()
  })
})
