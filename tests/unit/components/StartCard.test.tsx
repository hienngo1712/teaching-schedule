/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const statusData = { current: undefined as unknown }
const dismissMutate = vi.fn()
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ onboarding: { status: { setData: vi.fn(), invalidate: vi.fn() } } }),
    onboarding: {
      status: { useQuery: () => ({ data: statusData.current }) },
      dismiss: { useMutation: () => ({ mutate: dismissMutate, isPending: false }) },
    },
  },
}))

import { StartCard } from "@/components/dashboard/StartCard"

const steps = (o: Partial<Record<"student" | "session" | "attendance" | "payment" | "bank", boolean>> = {}) => ({
  student: false, session: false, attendance: false, payment: false, bank: false, ...o,
})
const renderVi = () => render(<LanguageProvider forcedLanguage="vi"><StartCard /></LanguageProvider>)

describe("StartCard (spec W §4)", () => {
  beforeEach(() => dismissMutate.mockReset())

  it("đang tải → không render gì", () => {
    statusData.current = undefined
    const { container } = renderVi()
    expect(container.textContent).toBe("")
  })

  it("hiện 5 bước, tiến độ 2/5, bước xong có dấu xong", () => {
    statusData.current = { dismissed: false, steps: steps({ student: true, session: true }) }
    renderVi()
    expect(screen.getByText(viText.start_title)).toBeTruthy()
    expect(screen.getByText(viText.start_progress.replace("{n}", "2").replace("{total}", "5"))).toBeTruthy()
    expect(screen.getAllByTestId("start-step")).toHaveLength(5)
    expect(screen.getAllByTestId("start-step-done")).toHaveLength(2)
  })

  it("link hướng dẫn mở tab mới tới đúng mục", () => {
    statusData.current = { dismissed: false, steps: steps() }
    renderVi()
    const links = screen.getAllByRole("link", { name: viText.start_guide })
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/guide#hoc-sinh", "/guide#lich-day", "/guide#diem-danh", "/guide#hoc-phi", "/guide#tai-khoan-ngan-hang",
    ])
    expect(links.every((a) => a.getAttribute("target") === "_blank")).toBe(true)
  })

  it("đủ 5 bước hoặc đã ẩn → không render", () => {
    statusData.current = { dismissed: false, steps: steps({ student: true, session: true, attendance: true, payment: true, bank: true }) }
    expect(renderVi().container.textContent).toBe("")
    statusData.current = { dismissed: true, steps: steps() }
    expect(renderVi().container.textContent).toBe("")
  })

  it("bấm Ẩn → gọi dismiss", () => {
    statusData.current = { dismissed: false, steps: steps() }
    renderVi()
    fireEvent.click(screen.getByRole("button", { name: viText.start_dismiss }))
    expect(dismissMutate).toHaveBeenCalledTimes(1)
  })
})
