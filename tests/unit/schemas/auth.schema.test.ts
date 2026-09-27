import { describe, it, expect } from "vitest"
import { changePasswordSchema } from "@/lib/schemas/auth"

const firstMessage = (input: unknown) => {
  const r = changePasswordSchema.safeParse(input)
  return r.success ? null : r.error.issues[0]?.message
}

describe("changePasswordSchema (spec N R2)", () => {
  it("hợp lệ khi mới ≥10 ký tự và khác hiện tại", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "teacher123", newPassword: "NewSecret@2026" }).success).toBe(true)
  })
  it("mới < 10 ký tự → thông báo độ dài", () => {
    expect(firstMessage({ currentPassword: "teacher123", newPassword: "short" })).toBe("Mật khẩu mới phải có ít nhất 10 ký tự")
  })
  it("mới trùng hiện tại (vd giữ nguyên mật khẩu tạm) → từ chối", () => {
    expect(firstMessage({ currentPassword: "Lich-7k2m-Qx9f", newPassword: "Lich-7k2m-Qx9f" })).toBe(
      "Mật khẩu mới phải khác mật khẩu hiện tại"
    )
  })
  it("bỏ field lạ (client không gửi được username)", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "teacher123", newPassword: "NewSecret@2026", username: "x" })
    expect(r.success && "username" in r.data).toBe(false)
  })
})
