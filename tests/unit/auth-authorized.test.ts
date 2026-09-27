import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authConfig } from "@/server/auth.config"

const authorized = authConfig.callbacks.authorized
const original = process.env.ADMIN_USERNAMES
const ADMIN = { user: { id: "9", username: "admin_test" }, expires: "" }
const TEACHER = { user: { id: "1", username: "teacher" }, expires: "" }

function call(auth: unknown, path = "/dashboard") {
  return authorized({ auth, request: { nextUrl: new URL(path, "http://localhost:3000") } } as unknown as Parameters<typeof authorized>[0])
}

beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
})
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USERNAMES
  else process.env.ADMIN_USERNAMES = original
})

// GHSA-8fpg-xm3f-6cx3: khi cấu hình lỗi, `auth` là object chứa error nhưng
// không có `user` — check kiểu `!!auth` sẽ cho qua.
describe("authConfig.callbacks.authorized", () => {
  it("cho qua khi có user", () => {
    expect(call(TEACHER)).toBe(true)
  })

  it("chặn khi chưa đăng nhập", () => {
    expect(call(null)).toBe(false)
  })

  it("chặn khi auth là object lỗi, không có user", () => {
    expect(call({ error: "Configuration" })).toBe(false)
  })

  it("admin vào route ngoài khu quản trị (kể cả /administration, /api/backup) → 302 về /admin/orders", () => {
    for (const path of ["/", "/dashboard", "/students/5", "/plan", "/api/backup", "/administration", "/adminx"]) {
      const res = call(ADMIN, path)
      expect(res, path).toBeInstanceOf(Response)
      expect((res as Response).status, path).toBe(302)
      expect((res as Response).headers.get("location"), path).toBe("http://localhost:3000/admin/orders")
    }
  })

  it("admin trong khu quản trị → cho qua, không vòng redirect", () => {
    for (const path of ["/admin", "/admin/orders", "/admin/accounts", "/admin/history"]) {
      expect(call(ADMIN, path), path).toBe(true)
    }
  })

  it("giáo viên vào /admin/* → cho qua để layout trả 404; env thiếu thì admin_test là người thường", () => {
    for (const path of ["/admin", "/admin/orders", "/dashboard"]) {
      expect(call(TEACHER, path), path).toBe(true)
    }
    delete process.env.ADMIN_USERNAMES
    expect(call(ADMIN, "/dashboard")).toBe(true)
  })
})
