/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CONSENT_ACCEPTED } from "@/lib/consent"

// jsdom không có ResizeObserver mà Radix Checkbox cần (đo input ẩn).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const registerMutate = vi.fn()
const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      register: {
        useMutation: () => ({ mutate: registerMutate, isPending: false }),
      },
    },
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RegisterForm } from "@/app/register/RegisterForm"

describe("RegisterForm: ô đồng ý và chính sách bảo mật (spec O 6.6, 6.7)", () => {
  beforeEach(() => {
    registerMutate.mockReset()
    pushMock.mockReset()
  })

  it("hiển thị gợi ý tên đăng nhập, link chính sách bảo mật và nút đăng ký disabled tới khi tick đồng ý", async () => {
    render(
      <LanguageProvider>
        <RegisterForm />
      </LanguageProvider>
    )

    // Gợi ý tên đăng nhập
    expect(screen.getByText(viText.register_username_hint)).toBeTruthy()

    // Link tới /privacy
    const privacyLink = screen.getByRole("link", { name: viText.privacy_title })
    expect(privacyLink.getAttribute("href")).toBe("/privacy")

    // Nút đăng ký bị disabled khi chưa tick ô đồng ý
    const submitBtn = screen.getByRole("button", { name: viText.register })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)

    // Điền form
    fireEvent.change(screen.getByLabelText(viText.username), { target: { value: "giaovien_test" } })
    fireEvent.change(screen.getByLabelText(viText.password), { target: { value: "MatKhau123456" } })

    // Tick ô đồng ý
    const checkbox = screen.getByRole("checkbox", { name: viText.consent_register })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(checkbox)
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false)

    // Bấm đăng ký
    fireEvent.click(submitBtn)
    await waitFor(() => expect(registerMutate).toHaveBeenCalledTimes(1))
    expect(registerMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "giaovien_test",
        password: "MatKhau123456",
        consent: CONSENT_ACCEPTED,
      })
    )
  })
})
