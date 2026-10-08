/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { latestNotifyRelease, type Release } from "@/lib/releases"
import { setTourActive } from "@/lib/tour-store"

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

const status = { current: undefined as { lastSeenRelease: string | null } | undefined }
const markSeen = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ release: { status: { setData: vi.fn() } } }),
    release: {
      status: { useQuery: () => ({ data: status.current }) },
      markSeen: { useMutation: () => ({ mutate: markSeen }) },
    },
  },
}))

import { WhatsNew } from "@/components/whats-new/WhatsNew"
import { WhatsNewPanel } from "@/components/whats-new/WhatsNewPanel"

const LATEST = latestNotifyRelease()!
const renderVi = (ui: React.ReactElement) => render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)

beforeEach(() => {
  markSeen.mockReset()
  toastError.mockReset()
  // Desktop: Popover.
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("WhatsNew (spec W §5.2–5.4)", () => {
  it("chưa xem → có chấm báo và ô tự mở với tiêu đề bản mới nhất", async () => {
    status.current = { lastSeenRelease: null }
    renderVi(<WhatsNew />)
    expect(screen.getByTestId("whatsnew-dot")).toBeTruthy()
    expect(await screen.findByText(LATEST.title)).toBeTruthy()
  })

  it("đóng ô → markSeen đúng version bản notify mới nhất, không toast", async () => {
    status.current = { lastSeenRelease: null }
    renderVi(<WhatsNew />)
    await screen.findByText(LATEST.title)
    fireEvent.click(screen.getByRole("button", { name: viText.whatsnew_close }))
    await waitFor(() => expect(screen.queryByText(LATEST.title)).toBeNull())
    expect(markSeen).toHaveBeenCalledWith({ version: LATEST.version })
    expect(toastError).not.toHaveBeenCalled()
  })

  it("đã xem → không chấm, không tự mở; bấm nút vẫn mở được, đóng không gọi markSeen", async () => {
    status.current = { lastSeenRelease: LATEST.version }
    renderVi(<WhatsNew />)
    expect(screen.queryByTestId("whatsnew-dot")).toBeNull()
    expect(screen.queryByText(LATEST.title)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: new RegExp(viText.whatsnew_button) }))
    expect(await screen.findByText(LATEST.title)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: viText.whatsnew_close }))
    await waitFor(() => expect(screen.queryByText(LATEST.title)).toBeNull())
    expect(markSeen).not.toHaveBeenCalled()
  })

  it("đang tải status → không tự mở", () => {
    status.current = undefined
    renderVi(<WhatsNew />)
    expect(screen.queryByText(LATEST.title)).toBeNull()
  })

  it("đang có tour thì không tự mở; tour tắt thì mở", async () => {
    status.current = { lastSeenRelease: null }
    setTourActive(true)
    renderVi(<WhatsNew />)
    expect(screen.queryByText(LATEST.title)).toBeNull()
    act(() => setTourActive(false))
    expect(await screen.findByText(LATEST.title)).toBeTruthy()
  })
})

describe("WhatsNewPanel (spec W §5.3)", () => {
  const many: Release = {
    version: "9.0.0", date: "2026-12-01", title: "Bản thử", summary: "Tóm tắt", notify: true,
    items: Array.from({ length: 7 }, (_, i) => ({ kind: "new" as const, title: `Mục ${i + 1}`, body: "Mô tả" })),
  }

  it("gọn: tối đa 3 mục + 'và 4 thay đổi khác'; ngày dd/MM/yyyy; Tìm hiểu thêm mở /updates#v9.0.0 tab mới", () => {
    renderVi(<WhatsNewPanel release={many} onClose={() => {}} />)
    expect(screen.getAllByTestId("whatsnew-item")).toHaveLength(3)
    expect(screen.getByText(viText.whatsnew_more.replace("{n}", "4"))).toBeTruthy()
    expect(screen.getByText("01/12/2026")).toBeTruthy()
    const more = screen.getByRole("link", { name: new RegExp(viText.whatsnew_learn_more) })
    expect(more.getAttribute("href")).toBe("/updates#v9.0.0")
    expect(more.getAttribute("target")).toBe("_blank")
  })

  it("nhãn loại theo kind", () => {
    renderVi(<WhatsNewPanel release={{ ...many, items: [
      { kind: "new", title: "A", body: "a" }, { kind: "improve", title: "B", body: "b" }, { kind: "fix", title: "C", body: "c" },
    ] }} onClose={() => {}} />)
    expect(screen.getByText(viText.whatsnew_kind_new)).toBeTruthy()
    expect(screen.getByText(viText.whatsnew_kind_improve)).toBeTruthy()
    expect(screen.getByText(viText.whatsnew_kind_fix)).toBeTruthy()
  })
})
