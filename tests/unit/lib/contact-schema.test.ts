import { describe, it, expect } from "vitest"
import { contactInputSchema } from "@/lib/schemas/contact"
const ok = (v: object) => contactInputSchema.safeParse(v).success
describe("contactInputSchema", () => {
  it("SĐT: chỉ số, 9–11 chữ số, bắt đầu 0; bỏ khoảng trắng/dấu chấm", () => {
    expect(ok({ phone: "0979479550", facebookUrl: "" })).toBe(true)
    expect(ok({ phone: "0979 479 550", facebookUrl: "" })).toBe(true)
    expect(contactInputSchema.parse({ phone: "0979.479.550", facebookUrl: "" }).phone).toBe("0979479550")
    for (const p of ["979479550", "09794795501234", "09a9479550", ""]) expect(ok({ phone: p, facebookUrl: "" })).toBe(false)
  })
  it("Facebook: https + host facebook.com/www/m/fb.com; rỗng → null", () => {
    expect(ok({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })).toBe(true)
    expect(ok({ phone: "0979479550", facebookUrl: "https://fb.com/x" })).toBe(true)
    for (const u of ["http://facebook.com/x", "https://evil.com/facebook.com", "javascript:alert(1)", "https://facebook.com.evil.com/x"]) {
      expect(ok({ phone: "0979479550", facebookUrl: u })).toBe(false)
    }
    expect(contactInputSchema.parse({ phone: "0979479550", facebookUrl: "  " }).facebookUrl).toBeNull()
  })
})
