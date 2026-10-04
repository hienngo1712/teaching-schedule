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
})
