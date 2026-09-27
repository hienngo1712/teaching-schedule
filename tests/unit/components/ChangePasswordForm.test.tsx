/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  action: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ ok: true })),
}))
vi.mock("@/app/actions/change-password", () => ({ changePasswordAction: mocks.action }))

import { ChangePasswordForm } from "@/components/layout/ChangePasswordForm"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

function renderForm(ui: React.ReactElement, lang: "vi" | "en" = "vi") {
  return render(<LanguageProvider forcedLanguage={lang}>{ui}</LanguageProvider>)
}

function fill(container: HTMLElement, current: string, next: string, confirm = next, submit = "Đổi mật khẩu") {
  fireEvent.change(container.querySelector("#current-pw")!, { target: { value: current } })
  fireEvent.change(container.querySelector("#new-pw")!, { target: { value: next } })
  fireEvent.change(container.querySelector("#confirm-pw")!, { target: { value: confirm } })
  fireEvent.click(screen.getByRole("button", { name: submit }))
}

beforeEach(() => {
  mocks.action.mockReset()
  mocks.action.mockResolvedValue({ ok: true })
})

describe("ChangePasswordForm", () => {
  it("mật khẩu mới < 10 ký tự / trùng hiện tại / xác nhận lệch → báo lỗi tại chỗ, không gọi action", () => {
    const { container } = renderForm(<ChangePasswordForm onSuccess={vi.fn()} />)
    fill(container, "teacher123", "short")
    expect(screen.getByRole("alert").textContent).toBe("Mật khẩu mới phải có ít nhất 10 ký tự")
    fill(container, "Lich-7k2m-Qx9f", "Lich-7k2m-Qx9f")
    expect(screen.getByRole("alert").textContent).toBe("Mật khẩu mới phải khác mật khẩu hiện tại")
    fill(container, "teacher123", "NewSecret@2026", "NewSecret@2027")
    expect(screen.getByRole("alert").textContent).toBe("Xác nhận mật khẩu không khớp")
    expect(mocks.action).not.toHaveBeenCalled()
  })

  it("thành công → onSuccess(false); relogin → onSuccess(true)", async () => {
    const onSuccess = vi.fn()
    const { container } = renderForm(<ChangePasswordForm onSuccess={onSuccess} />)
    fill(container, "teacher123", "NewSecret@2026")
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(false))
    expect(mocks.action).toHaveBeenCalledWith({ currentPassword: "teacher123", newPassword: "NewSecret@2026" })
    mocks.action.mockResolvedValueOnce({ ok: true, relogin: true })
    fill(container, "teacher123", "NewSecret@2026")
    await waitFor(() => expect(onSuccess).toHaveBeenLastCalledWith(true))
  })

  it("sai mật khẩu cũ → hiện thông báo server; hết phiên → báo đăng nhập lại", async () => {
    mocks.action.mockResolvedValueOnce({ ok: false, error: "WRONG_CURRENT", message: "Mật khẩu hiện tại không đúng" })
    const { container } = renderForm(<ChangePasswordForm onSuccess={vi.fn()} />)
    fill(container, "wrong-pass", "NewSecret@2026")
    expect((await screen.findByRole("alert")).textContent).toBe("Mật khẩu hiện tại không đúng")
    mocks.action.mockResolvedValueOnce({ ok: false, error: "UNAUTHORIZED" })
    fill(container, "teacher123", "NewSecret@2026")
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Phiên đăng nhập đã hết, vui lòng đăng nhập lại")
    )
  })

  it("quá nhiều lần sai → báo thử lại sau", async () => {
    mocks.action.mockResolvedValueOnce({ ok: false, error: "RATE_LIMITED" })
    const { container } = renderForm(<ChangePasswordForm onSuccess={vi.fn()} />)
    fill(container, "teacher123", "NewSecret@2026")
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Nhập sai mật khẩu hiện tại quá nhiều lần. Vui lòng thử lại sau 15 phút."
    )
  })

  it("ngôn ngữ en → nhãn, nút, lỗi bằng tiếng Anh", async () => {
    const { container } = renderForm(<ChangePasswordForm onSuccess={vi.fn()} onCancel={vi.fn()} />, "en")
    expect(screen.getByText("Current password")).toBeTruthy()
    expect(screen.getByText("New password")).toBeTruthy()
    expect(screen.getByText("Confirm new password")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy()
    fill(container, "teacher123", "short", "short", "Change Password")
    expect(screen.getByRole("alert").textContent).toBe("New password must be at least 10 characters")
    mocks.action.mockResolvedValueOnce({ ok: false, error: "WRONG_CURRENT", message: "Mật khẩu hiện tại không đúng" })
    fill(container, "wrong-pass", "NewSecret@2026", "NewSecret@2026", "Change Password")
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Current password is incorrect"))
  })

  it("nút Hủy chỉ có khi truyền onCancel", () => {
    const { unmount } = renderForm(<ChangePasswordForm onSuccess={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Hủy" })).toBeNull()
    unmount()
    const onCancel = vi.fn()
    renderForm(<ChangePasswordForm onSuccess={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))
    expect(onCancel).toHaveBeenCalled()
  })
})
