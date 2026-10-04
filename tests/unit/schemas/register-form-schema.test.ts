import { describe, it, expect } from "vitest"
import { registerFormSchema } from "@/lib/schemas/auth"

const base = { username: "gv_moi", password: "MatKhau123456", fullName: "" }

describe("registerFormSchema (spec X §4)", () => {
  it("khớp → hợp lệ", () => {
    expect(registerFormSchema("x").safeParse({ ...base, confirmPassword: "MatKhau123456" }).success).toBe(true)
  })

  it("không khớp → lỗi ở confirmPassword với message truyền vào", () => {
    const r = registerFormSchema("Không khớp").safeParse({ ...base, confirmPassword: "MatKhau12345" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues).toEqual([
        expect.objectContaining({ path: ["confirmPassword"], message: "Không khớp" }),
      ])
    }
  })

  it("ô xác nhận trống → không hợp lệ", () => {
    expect(registerFormSchema("x").safeParse({ ...base, confirmPassword: "" }).success).toBe(false)
  })

  it("tên đăng nhập sai + không khớp → có cả 2 lỗi trong 1 lần kiểm", () => {
    const r = registerFormSchema("Không khớp").safeParse({ ...base, username: "a", confirmPassword: "Khac123456" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."))
      expect(paths).toContain("username")
      expect(paths).toContain("confirmPassword")
    }
  })
})
