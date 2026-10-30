/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import type { TuitionNoticeDTO } from "@/lib/types/models"

vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,x") }))

const base: TuitionNoticeDTO = {
  studentId: 1, fullName: "HS A", grade: 5, year: 2026, month: 10, totalSessions: 0, presentSessions: 0,
  billingMode: "per_session", monthlyFee: 0, currentMonthFee: 0, previousBalance: 480000, totalAmountDue: 480000,
  paidAmount: 0, isFullPaid: false, presentDates: [], payments: [], remaining: 480000, overpaid: 0,
  inProgress: false, debtMonths: 2, teacherName: "GV", bankConfigured: false, qr: null, parentComment: null,
}

const renderCard = (notice: TuitionNoticeDTO) =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <TuitionNoticeCard notice={notice} />
    </LanguageProvider>
  )

describe("TuitionNoticeCard: tách nợ cũ từng tháng (AU)", () => {
  it("có debtBreakdown nhiều tháng → từng tháng + Tổng nợ cũ, không còn dòng gộp", () => {
    renderCard({ ...base, debtBreakdown: [{ year: 2026, month: 8, amount: 200000 }, { year: 2026, month: 9, amount: 280000 }] })
    expect(screen.getByText("Tháng 8 còn thiếu")).toBeTruthy()
    expect(screen.getByText("Tháng 9 còn thiếu")).toBeTruthy()
    expect(screen.getByText("Tổng nợ cũ")).toBeTruthy()
    expect(screen.queryByText("Nợ 2 tháng trước")).toBeNull()
  })

  it("không có debtBreakdown → dòng gộp như cũ", () => {
    renderCard(base)
    expect(screen.getByText("Nợ 2 tháng trước")).toBeTruthy()
    expect(screen.queryByText("Tổng nợ cũ")).toBeNull()
  })
})
