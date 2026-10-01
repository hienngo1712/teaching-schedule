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
})
