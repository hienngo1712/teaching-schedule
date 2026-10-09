/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import type { TuitionNoticeDTO } from "@/lib/types/models"

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
  inProgress: false,
  debtMonths: 0,
  teacherName: "Giáo viên A",
  bankConfigured: true,
  qr: {
    provider: "vietqr",
    checkoutUrl: null,
    payload: "sample-qr",
    bankShortName: "MBBank",
    accountNumber: "123456",
    accountName: "NGUYEN VAN A",
    amount: 400000,
    content: "HP T5",
  },
}

describe("TuitionNoticeCard - variant wide (spec Y Task 7)", () => {
  it("variant='wide' -> không có Ngày học, width full, qr-side grid", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeCard notice={baseNotice} variant="wide" />
      </LanguageProvider>
    )
    const card = screen.getByTestId("notice-card")
    expect(card.className).toContain("w-full")
    expect(card.style.width).toBe("")
    expect(screen.queryByText(/Ngày học/)).toBeNull()
    expect(screen.getByTestId("notice-qr-side")).toBeDefined()
    expect(screen.getByTestId("notice-qr-side").className).toContain("grid")
  })

  it("variant='default' -> có Ngày học, style width 360", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeCard notice={baseNotice} />
      </LanguageProvider>
    )
    const card = screen.getByTestId("notice-card")
    expect(card.style.width).toBe("360px")
    expect(screen.getByText(/Ngày học/)).toBeDefined()
  })
})
