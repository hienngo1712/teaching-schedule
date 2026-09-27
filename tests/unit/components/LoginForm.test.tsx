/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const mocks = vi.hoisted(() => ({
  query: new URLSearchParams(),
  replace: vi.fn(),
  loginAction: vi.fn<(fd: FormData) => Promise<{ ok: boolean; error?: "INVALID_CREDENTIALS" }>>(async () => ({
    ok: false,
    error: "INVALID_CREDENTIALS",
  })),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
  useSearchParams: () => mocks.query,
}))
vi.mock("@/app/login/actions", () => ({ loginAction: mocks.loginAction }))

import { LoginForm } from "@/app/login/LoginForm"

// jsdom không có ResizeObserver mà Radix Checkbox cần (đo input ẩn).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const REMEMBER = "Ghi nhớ đăng nhập (30 ngày)"
const EXPIRED = "Phiên đăng nhập đã hết hoặc có phiên bản mới. Vui lòng đăng nhập lại."

function renderForm(query = "") {
  mocks.query = new URLSearchParams(query)
  const view = render(
    <LanguageProvider forcedLanguage="vi">
      <LoginForm />
    </LanguageProvider>
  )
  fireEvent.change(view.container.querySelector('input[name="username"]')!, { target: { value: "teacher" } })
  fireEvent.change(view.container.querySelector('input[name="password"]')!, { target: { value: "teacher123" } })
  return view
}

beforeEach(() => {
  mocks.loginAction.mockClear()
  mocks.replace.mockClear()
})

describe("LoginForm — ghi nhớ đăng nhập (spec N 6.4)", () => {
  it("mặc định không tick; bấm vào chữ thì tick", () => {
    renderForm()
    const box = screen.getByRole("checkbox", { name: REMEMBER })
    expect(box.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(screen.getByText(REMEMBER))
    expect(box.getAttribute("aria-checked")).toBe("true")
  })

  it("tick → form gửi remember=on", async () => {
    renderForm()
    fireEvent.click(screen.getByText(REMEMBER))
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await waitFor(() => expect(mocks.loginAction).toHaveBeenCalledTimes(1))
    expect(mocks.loginAction.mock.calls[0][0].get("remember")).toBe("on")
  })

  it("không tick → form không có remember", async () => {
    // Render riêng: React 19 tự reset form sau action nên không gửi lại trên cùng form được.
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await waitFor(() => expect(mocks.loginAction).toHaveBeenCalledTimes(1))
    expect(mocks.loginAction.mock.calls[0][0].get("remember")).toBeNull()
  })

  it("dòng checkbox cao ≥44px (min-h-11)", () => {
    renderForm()
    expect(screen.getByText(REMEMBER).closest("label")!.className).toContain("min-h-11")
  })
})

describe("LoginForm — thông báo hết phiên (spec N Q7)", () => {
  it("expired=1 → hộp role=status nền slate; không có thì không hiện", () => {
    renderForm("expired=1")
    const box = screen.getByRole("status")
    expect(box.textContent).toBe(EXPIRED)
    expect(box.className).toContain("bg-slate-50")
    expect(box.className).not.toMatch(/red/)
  })

  it("không có expired → không hiện", () => {
    renderForm("callbackUrl=%2Fstudents")
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("có lỗi đăng nhập → chỉ hiện lỗi, ẩn thông báo hết phiên", async () => {
    renderForm("expired=1")
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await screen.findByRole("alert")
    expect(screen.queryByRole("status")).toBeNull()
  })
})

describe("LoginForm — callbackUrl (chặn open redirect)", () => {
  it.each([
    ["callbackUrl=https%3A%2F%2Fevil.tld", "/dashboard"],
    ["callbackUrl=%2F%2Fevil.tld", "/dashboard"],
    ["callbackUrl=%2Fstudents%3Fx%3D1", "/students?x=1"],
    ["callbackUrl=" + encodeURIComponent(window.location.origin + "/students"), "/students"],
  ])("%s → %s", async (query, expected) => {
    mocks.loginAction.mockResolvedValueOnce({ ok: true })
    renderForm(query)
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expected))
  })
})
