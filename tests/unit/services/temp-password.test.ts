import { describe, it, expect } from "vitest"
import { generateTempPassword } from "@/server/services/password-reset.service"

describe("generateTempPassword (spec N R1)", () => {
  it("dạng Lich-xxxx-xxxx, 14 ký tự, không có ký tự dễ nhầm 0 O o 1 l I", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword()
      expect(p).toMatch(/^Lich-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)
      expect(p).toHaveLength(14)
      expect(p.slice(5)).not.toMatch(/[0Oo1lI]/)
    }
  })
  it("ngẫu nhiên: 200 lần không trùng", () => {
    expect(new Set(Array.from({ length: 200 }, generateTempPassword)).size).toBe(200)
  })
})
