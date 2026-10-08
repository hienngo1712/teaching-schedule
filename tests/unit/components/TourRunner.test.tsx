/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const nav = vi.hoisted(() => ({ search: "tour=student&month=3", pathname: "/students", replace: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}))
const status = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ onboarding: { status: { fetch: status.fetch } } }) } }))
const toast = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({ toast }))
const run = vi.hoisted(() => ({ runTour: vi.fn(() => ({ stop: vi.fn() })) }))
vi.mock("@/lib/tour-controller", () => run)
vi.mock("driver.js", () => ({ driver: vi.fn(() => ({ highlight: vi.fn(), destroy: vi.fn(), isActive: () => false })) }))
vi.mock("driver.js/dist/driver.css", () => ({}))

import { driver } from "driver.js"
import { TourRunner } from "@/components/tour/TourRunner"
import { isTourActive, setTourActive } from "@/lib/tour-store"

const renderVi = () => render(<LanguageProvider forcedLanguage="vi"><TourRunner /></LanguageProvider>)

beforeEach(() => {
  nav.search = "tour=student&month=3"
  nav.pathname = "/students"
  status.fetch.mockResolvedValue({ steps: { student: true, session: true } })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  setTourActive(false)
  document.body.innerHTML = ""
})

describe("TourRunner", () => {
  it("xoá ?tour= khỏi URL, giữ tham số khác, rồi chạy tour đúng bước", async () => {
    renderVi()
    expect(nav.replace).toHaveBeenCalledWith("/students?month=3", { scroll: false })
    await waitFor(() => expect(run.runTour).toHaveBeenCalled())
    const opts = (run.runTour.mock.calls[0] as unknown as [{ steps: { target: string | null }[] }])[0]
    expect(opts.steps[0].target).toBe("student-add")
    expect(isTourActive()).toBe(true)
  })

  it("giá trị lạ: chỉ xoá tham số, không chạy", async () => {
    nav.search = "tour=hack"
    renderVi()
    expect(nav.replace).toHaveBeenCalledWith("/students", { scroll: false })
    await new Promise((r) => setTimeout(r, 0))
    expect(run.runTour).not.toHaveBeenCalled()
  })

  it("đang có hộp mở: báo và không chạy", async () => {
    const d = document.createElement("div")
    d.setAttribute("role", "dialog")
    d.setAttribute("data-state", "open")
    document.body.appendChild(d)
    renderVi()
    expect(toast).toHaveBeenCalledWith("Đóng hộp đang mở rồi bấm Chỉ cho tôi lại nhé.")
    await new Promise((r) => setTimeout(r, 0))
    expect(run.runTour).not.toHaveBeenCalled()
  })

  it("Điểm danh khi chưa có ca: chạy bước báo thiếu", async () => {
    nav.search = "tour=attendance"
    nav.pathname = "/calendar"
    status.fetch.mockResolvedValue({ steps: { student: true, session: false } })
    renderVi()
    await waitFor(() => expect(run.runTour).toHaveBeenCalled())
    const opts = (run.runTour.mock.calls[0] as unknown as [{ steps: { nextTour?: string }[] }])[0]
    expect(opts.steps).toHaveLength(1)
    expect(opts.steps[0].nextTour).toBe("session")
  })

  it("không có ?tour=: không làm gì", () => {
    nav.search = ""
    renderVi()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("đọc trạng thái Bắt đầu mới nhất, không lấy cache (vừa tạo ca xong bấm Điểm danh)", async () => {
    nav.search = "tour=attendance"
    nav.pathname = "/calendar"
    renderVi()
    await waitFor(() => expect(run.runTour).toHaveBeenCalled())
    expect(status.fetch).toHaveBeenCalledWith(undefined, { staleTime: 0 })
  })

  it("Esc / bấm ra lớp phủ (kể cả lúc driver chưa xong hiệu ứng) đều dọn tour qua onDestroyStarted", async () => {
    renderVi()
    await waitFor(() => expect(run.runTour).toHaveBeenCalled())
    const config = (vi.mocked(driver).mock.calls[0] as unknown as [{ onDestroyStarted?: () => void }])[0]
    const handle = (run.runTour.mock.results[0] as { value: { stop: ReturnType<typeof vi.fn> } }).value
    expect(config.onDestroyStarted).toBeTypeOf("function")
    config.onDestroyStarted!()
    expect(handle.stop).toHaveBeenCalled()
  })
})
