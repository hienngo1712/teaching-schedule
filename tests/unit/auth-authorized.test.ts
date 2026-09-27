import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authConfig } from "@/server/auth.config"

const authorized = authConfig.callbacks.authorized
const original = process.env.ADMIN_USERNAMES
const ADMIN = { user: { id: "9", username: "admin_test" }, expires: "" }
const TEACHER = { user: { id: "1", username: "teacher" }, expires: "" }
const MUST_CHANGE = { user: { id: "1", username: "teacher", mustChangePassword: true }, expires: "" }

function call(auth: unknown, path = "/dashboard", cookieNames: string[] = []) {
  const request = {
    nextUrl: new URL(path, "http://localhost:3000"),
    cookies: { getAll: () => cookieNames.map((name) => ({ name, value: "x" })) },
  }
  return authorized({ auth, request } as unknown as Parameters<typeof authorized>[0])
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

  it("không có user nhưng còn cookie phiên (hết hạn / lệch phiên bản) → 302 /login kèm callbackUrl + expired=1", () => {
    for (const name of ["authjs.session-token", "__Secure-authjs.session-token", "authjs.session-token.0"]) {
      const res = call(null, "/students?x=1", [name])
      expect(res, name).toBeInstanceOf(Response)
      expect((res as Response).status, name).toBe(302)
      const loc = new URL((res as Response).headers.get("location")!)
      expect(loc.pathname).toBe("/login")
      expect(loc.searchParams.get("callbackUrl")).toBe("http://localhost:3000/students?x=1")
      expect(loc.searchParams.get("expired")).toBe("1")
    }
  })

  it("không có user, không cookie phiên (chỉ cookie khác) → false để thư viện tự về /login", () => {
    expect(call(null, "/dashboard", ["authjs.csrf-token", "lang"])).toBe(false)
  })

  it("auth là object lỗi + còn cookie → vẫn chặn (redirect), không cho qua", () => {
    const res = call({ error: "Configuration" }, "/dashboard", ["authjs.session-token"])
    expect(res).toBeInstanceOf(Response)
  })

  it("đang bị bắt đổi mật khẩu → mọi route (kể cả /api/backup) 302 về /change-password; ở /change-password thì cho qua", () => {
    for (const path of ["/dashboard", "/students", "/api/backup", "/plan"]) {
      const res = call(MUST_CHANGE, path)
      expect(res, path).toBeInstanceOf(Response)
      expect((res as Response).headers.get("location"), path).toBe("http://localhost:3000/change-password")
    }
    expect(call(MUST_CHANGE, "/change-password")).toBe(true)
    expect(call(TEACHER, "/change-password")).toBe(true)
  })
})
