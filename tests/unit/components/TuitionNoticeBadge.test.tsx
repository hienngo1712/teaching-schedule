/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionNoticeBadge } from "@/components/tuition/TuitionNoticeBadge"

describe("TuitionNoticeBadge", () => {
  it("noticeStatus === 'none' -> không hiển thị gì", () => {
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeBadge item={{ noticeStatus: "none", noticeSentAt: null }} />
      </LanguageProvider>
    )
    expect(container.firstChild).toBeNull()
  })

  it("noticeStatus === 'sent' + noticeSentAt -> 'Đã gửi 30/9'", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeBadge item={{ noticeStatus: "sent", noticeSentAt: "2026-09-30T13:15:00.000Z" }} />
      </LanguageProvider>
    )
    expect(screen.getByText("Đã gửi 30/9")).toBeDefined()
  })

  it("noticeStatus === 'changed' -> 'Đã gửi · số tiền đã đổi'", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeBadge item={{ noticeStatus: "changed", noticeSentAt: "2026-09-30T13:15:00.000Z" }} />
      </LanguageProvider>
    )
    expect(screen.getByText("Đã gửi · số tiền đã đổi")).toBeDefined()
  })

  it("noticeStatus === 'sent' + due > 0: hiện đếm ngày, ≥ 7 ngày amber, < 7 ngày slate", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString()
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()

    const { rerender } = render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeBadge item={{ noticeStatus: "sent", noticeSentAt: eightDaysAgo, due: 200_000 }} />
      </LanguageProvider>
    )
    const b8 = screen.getByText(/Đã gửi .* · 8 ngày/)
    expect(b8).toBeDefined()
    expect(b8.className).toContain("text-amber-700")

    rerender(
      <LanguageProvider forcedLanguage="vi">
        <TuitionNoticeBadge item={{ noticeStatus: "sent", noticeSentAt: threeDaysAgo, due: 200_000 }} />
      </LanguageProvider>
    )
    const b3 = screen.getByText(/Đã gửi .* · 3 ngày/)
    expect(b3).toBeDefined()
    expect(b3.className).toContain("text-slate-700")
  })

  // Spec AH §7: PH chuyển qua payOS.
  it("có payosPaidAt → dòng xanh 'PH đã chuyển 200.000 đ lúc 14:32 ngày 9/10' thay nhắc đã gửi phiếu", () => {
    render(<LanguageProvider forcedLanguage="vi"><TuitionNoticeBadge item={{ noticeStatus: "sent", noticeSentAt: "2026-10-01T03:00:00Z", due: 0, payosPaidAt: "2026-10-09T07:32:00.000Z", payosPaidAmount: 200000 }} /></LanguageProvider>)
    expect(screen.getByText(/PH đã chuyển 200\.000/)).toBeTruthy()
    expect(screen.getByText(/14:32 ngày 9\/10/)).toBeTruthy()
    expect(screen.queryByText(/đã gửi/i)).toBeNull()
  })
  it("noticeStatus none nhưng có payosPaidAt vẫn hiện dòng đã chuyển", () => {
    render(<LanguageProvider forcedLanguage="vi"><TuitionNoticeBadge item={{ noticeStatus: "none", noticeSentAt: null, due: 0, payosPaidAt: "2026-10-09T07:32:00.000Z", payosPaidAmount: 200000 }} /></LanguageProvider>)
    expect(screen.getByText(/PH đã chuyển 200\.000/)).toBeTruthy()
  })
  it("còn nợ sau khi PH chuyển (chuyển thiếu/ nợ mới) → hiện cả dòng đã chuyển, nhắc nợ giữ như cũ", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    render(<LanguageProvider forcedLanguage="vi"><TuitionNoticeBadge item={{ noticeStatus: "sent", noticeSentAt: threeDaysAgo, due: 50000, payosPaidAt: "2026-10-09T07:32:00.000Z", payosPaidAmount: 150000 }} /></LanguageProvider>)
    expect(screen.getByText(/PH đã chuyển 150\.000/)).toBeTruthy()
    expect(screen.getByText(/3 ngày/)).toBeTruthy()
  })
})
