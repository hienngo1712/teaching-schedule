/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { signOut } from "next-auth/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }))

import { PasswordAlreadyChanged } from "@/app/change-password/PasswordAlreadyChanged"

describe("PasswordAlreadyChanged (spec P N1)", () => {
  it("tiêu đề + mô tả; 1 nút Đăng nhập lại ≥44px gọi signOut về /login", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <PasswordAlreadyChanged />
      </LanguageProvider>
    )
    expect(screen.getByRole("heading", { name: "Mật khẩu đã được cập nhật" })).toBeTruthy()
    expect(screen.getByText("Đăng nhập lại để tiếp tục dùng ứng dụng.")).toBeTruthy()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    const btn = screen.getByRole("button", { name: "Đăng nhập lại" })
    expect(btn.className).toContain("h-11")
    fireEvent.click(btn)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" })
  })
})
