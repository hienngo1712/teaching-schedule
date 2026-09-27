/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { toast } from "sonner"

type Opts = { onSuccess?: (r: { username: string; tempPassword: string }) => void; onError?: (e: { message: string }) => void }
const mut = vi.hoisted(() => ({ mutate: vi.fn(), opts: null as null | Opts }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      resetPassword: {
        useMutation: (opts: Opts) => {
          mut.opts = opts
          return { mutate: mut.mutate, isPending: false }
        },
      },
    },
  },
}))

import { ResetPasswordDialog } from "@/components/admin/ResetPasswordDialog"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]
const USER = { id: 42, username: "co_lan" } as unknown as UserRow

function renderDialog(onClose = vi.fn()) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <ResetPasswordDialog user={USER} onClose={onClose} />
    </LanguageProvider>
  )
  return onClose
}

beforeEach(() => {
  mut.mutate.mockReset()
  vi.mocked(toast.success).mockClear()
})

describe("ResetPasswordDialog (spec N R1)", () => {
  it("bước xác nhận nêu tên đăng nhập; bấm Reset → gọi mutation với userId", () => {
    renderDialog()
    expect(screen.getByRole("alertdialog").textContent).toContain("co_lan")
    expect(screen.queryByTestId("temp-password")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Reset mật khẩu" }))
    expect(mut.mutate).toHaveBeenCalledWith({ userId: 42 })
  })

  it("thành công → hiện mật khẩu tạm + Sao chép; đóng thì gọi onClose", async () => {
    const onClose = renderDialog()
    act(() => mut.opts!.onSuccess!({ username: "co_lan", tempPassword: "Lich-7k2m-Qx9f" }))
    expect(screen.getByTestId("temp-password").textContent).toBe("Lich-7k2m-Qx9f")
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sao chép" })))
    expect(writeText).toHaveBeenCalledWith("Lich-7k2m-Qx9f")
    expect(toast.success).toHaveBeenCalledWith("Đã sao chép")
    expect(screen.queryByRole("button", { name: "Reset mật khẩu" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Tôi đã lưu mật khẩu" }))
    expect(onClose).toHaveBeenCalled()
  })

  it("Hủy ở bước xác nhận → onClose, không gọi mutation", () => {
    const onClose = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))
    expect(onClose).toHaveBeenCalled()
    expect(mut.mutate).not.toHaveBeenCalled()
  })

  it("nút cao ≥44px ở mobile", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: "Reset mật khẩu" }).className).toContain("h-11")
  })
})
