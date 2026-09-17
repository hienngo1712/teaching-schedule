import { describe, it, expect } from "vitest"
import { authConfig } from "@/server/auth.config"

// GHSA-8fpg-xm3f-6cx3: khi cấu hình lỗi, `auth` là object chứa error nhưng
// không có `user` — check kiểu `!!auth` sẽ cho qua.
describe("authConfig.callbacks.authorized", () => {
  const authorized = authConfig.callbacks.authorized

  function call(auth: unknown) {
    return authorized({ auth } as Parameters<typeof authorized>[0])
  }

  it("cho qua khi có user", () => {
    expect(call({ user: { id: "1" }, expires: "" })).toBe(true)
  })

  it("chặn khi chưa đăng nhập", () => {
    expect(call(null)).toBe(false)
  })

  it("chặn khi auth là object lỗi, không có user", () => {
    expect(call({ error: "Configuration" })).toBe(false)
  })
})
