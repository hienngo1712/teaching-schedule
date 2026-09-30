/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { SessionNavBar, sortSessions } from "@/components/sessions/SessionNavBar"
import type { SessionListDTO } from "@/lib/types/models"

const makeSession = (id: number, date: string, start: string): SessionListDTO => ({
  id,
  userId: 1,
  sessionDate: new Date(date),
  startTime: start,
  endTime: "10:00",
  durationMins: 60,
  subjectId: 1,
  subject: { id: 1, name: "Toán", color: "#000" },
  title: null,
  notes: null,
  status: "scheduled",
  cancelReason: null,
  cancelledAt: null,
  makeupOfId: null,
  studentCount: 1,
  grades: [5],
  level: "tieu_hoc",
  isDeleted: false,
  deletedAt: null,
})

// 3 ca chưa sắp: ngày 10 08:00 (id 1), ngày 3 17:00 (id 2), ngày 3 09:30 (id 3)
const s1 = makeSession(1, "2026-05-10", "08:00")
const s2 = makeSession(2, "2026-05-03", "17:00")
const s3 = makeSession(3, "2026-05-03", "09:30")
const siblingsUnsorted = [s1, s2, s3]
// Thứ tự sau khi sắp: s3 (ngày 3 09:30), s2 (ngày 3 17:00), s1 (ngày 10 08:00)

describe("SessionNavBar (spec S4)", () => {
  it("sortSessions sắp theo ngày rồi giờ bắt đầu rồi id", () => {
    const sorted = sortSessions(siblingsUnsorted)
    expect(sorted.map((s) => s.id)).toEqual([3, 2, 1])
  })

  it("current = s2 (ở giữa) → hiện Ca 2/3; nút Ca trước/sau hoạt động", () => {
    const onNavigate = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionNavBar siblings={siblingsUnsorted} current={s2} onNavigate={onNavigate} />
      </LanguageProvider>
    )

    expect(screen.getByText("Ca 2/3")).toBeDefined()

    const prevBtn = screen.getByRole("button", { name: "Ca trước" })
    const nextBtn = screen.getByRole("button", { name: "Ca sau" })
    expect((prevBtn as HTMLButtonElement).disabled).toBe(false)
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(nextBtn)
    expect(onNavigate).toHaveBeenCalledWith(s1)

    fireEvent.click(prevBtn)
    expect(onNavigate).toHaveBeenCalledWith(s3)
  })

  it("current = ca đầu → Ca trước disabled; current = ca cuối → Ca sau disabled", () => {
    const { rerender } = render(
      <LanguageProvider forcedLanguage="vi">
        <SessionNavBar siblings={siblingsUnsorted} current={s3} onNavigate={() => {}} />
      </LanguageProvider>
    )
    expect((screen.getByRole("button", { name: "Ca trước" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Ca sau" }) as HTMLButtonElement).disabled).toBe(false)

    rerender(
      <LanguageProvider forcedLanguage="vi">
        <SessionNavBar siblings={siblingsUnsorted} current={s1} onNavigate={() => {}} />
      </LanguageProvider>
    )
    expect((screen.getByRole("button", { name: "Ca trước" }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole("button", { name: "Ca sau" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("phím ArrowRight/ArrowDown → ca sau; ArrowLeft/ArrowUp → ca trước", () => {
    const onNavigate = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionNavBar siblings={siblingsUnsorted} current={s2} onNavigate={onNavigate} />
      </LanguageProvider>
    )

    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(onNavigate).toHaveBeenCalledWith(s1)

    onNavigate.mockClear()
    fireEvent.keyDown(window, { key: "ArrowDown" })
    expect(onNavigate).toHaveBeenCalledWith(s1)

    onNavigate.mockClear()
    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(onNavigate).toHaveBeenCalledWith(s3)

    onNavigate.mockClear()
    fireEvent.keyDown(window, { key: "ArrowUp" })
    expect(onNavigate).toHaveBeenCalledWith(s3)
  })

  // Review S I1: menu "⋮" (Radix) xử lý ↑↓ bằng preventDefault, sự kiện vẫn nổi lên window.
  it("phím đã bị thành phần khác xử lý (defaultPrevented) hoặc trong menu → KHÔNG đổi ca", () => {
    const onNavigate = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <div role="menu"><div role="menuitem" tabIndex={0} data-testid="mi">Thêm học sinh</div></div>
        <SessionNavBar siblings={siblingsUnsorted} current={s2} onNavigate={onNavigate} />
      </LanguageProvider>
    )
    const ev = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
    ev.preventDefault()
    window.dispatchEvent(ev)
    fireEvent.keyDown(screen.getByTestId("mi"), { key: "ArrowDown" })
    fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("phím khi đang gõ trong input/textarea/combobox → KHÔNG đổi ca", () => {
    const onNavigate = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <div>
          <textarea data-testid="notes" />
          <input data-testid="search" />
          <button role="combobox" aria-expanded="false" aria-controls="combo-list" data-testid="combo">Chọn</button>
          <SessionNavBar siblings={siblingsUnsorted} current={s2} onNavigate={onNavigate} />
        </div>
      </LanguageProvider>
    )

    const textarea = screen.getByTestId("notes")
    fireEvent.keyDown(textarea, { key: "ArrowRight" })
    expect(onNavigate).not.toHaveBeenCalled()

    const input = screen.getByTestId("search")
    fireEvent.keyDown(input, { key: "ArrowRight" })
    expect(onNavigate).not.toHaveBeenCalled()

    const combo = screen.getByTestId("combo")
    fireEvent.keyDown(combo, { key: "ArrowRight" })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("blocked = true (hộp con mở) → phím KHÔNG đổi ca", () => {
    const onNavigate = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionNavBar siblings={siblingsUnsorted} current={s2} onNavigate={onNavigate} blocked={true} />
      </LanguageProvider>
    )

    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("vuốt cảm ứng trên thanh nav: dx >= 60 và ngang > dọc", () => {
    const onNavigate = vi.fn()
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <SessionNavBar siblings={siblingsUnsorted} current={s2} onNavigate={onNavigate} />
      </LanguageProvider>
    )

    const nav = container.firstElementChild as HTMLElement

    // Vuốt sang trái: x từ 200 về 100 (dx = -100) → ca sau (s1)
    fireEvent.touchStart(nav, { touches: [{ clientX: 200, clientY: 100 }] })
    fireEvent.touchEnd(nav, { changedTouches: [{ clientX: 100, clientY: 110 }] })
    expect(onNavigate).toHaveBeenCalledWith(s1)

    onNavigate.mockClear()
    // Vuốt sang phải: x từ 100 lên 200 (dx = 100) → ca trước (s3)
    fireEvent.touchStart(nav, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(nav, { changedTouches: [{ clientX: 200, clientY: 110 }] })
    expect(onNavigate).toHaveBeenCalledWith(s3)

    onNavigate.mockClear()
    // dx < 60 → không gọi
    fireEvent.touchStart(nav, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(nav, { changedTouches: [{ clientX: 140, clientY: 100 }] })
    expect(onNavigate).not.toHaveBeenCalled()

    // dọc > ngang (|dy| > |dx|) → không gọi
    fireEvent.touchStart(nav, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(nav, { changedTouches: [{ clientX: 180, clientY: 200 }] })
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
