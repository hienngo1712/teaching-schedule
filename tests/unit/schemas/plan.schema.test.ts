import { describe, it, expect } from "vitest"
import { createOrderSchema, updatePricesSchema } from "@/lib/schemas/plan"

describe("createOrderSchema (spec L Q6)", () => {
  it("expectedAmount tùy chọn; có thì giữ nguyên số", () => {
    expect(createOrderSchema.parse({ plan: "plus", period: "year" }).expectedAmount).toBeUndefined()
    expect(createOrderSchema.parse({ plan: "plus", period: "year", expectedAmount: 490000 }).expectedAmount).toBe(490000)
  })
  it("expectedAmount phải nguyên dương", () => {
    for (const bad of [0, -1, 1.5]) {
      expect(createOrderSchema.safeParse({ plan: "plus", period: "year", expectedAmount: bad }).success).toBe(false)
    }
  })
})

describe("updatePricesSchema (spec L Q12, Q13)", () => {
  const expected = { plus: 49000, pro: 99000 }
  const ok = (plus: number, pro: number) => updatePricesSchema.safeParse({ prices: { plus, pro }, expected }).success

  it("giá lẻ 49.900 hợp lệ (không bắt buộc chẵn nghìn); biên 10.000 và 1.000.000 hợp lệ", () => {
    expect(ok(49900, 99000)).toBe(true)
    expect(ok(10000, 1000000)).toBe(true)
  })
  it("không nguyên hoặc ngoài 10.000–1.000.000 → lỗi", () => {
    expect(ok(49900.5, 99000)).toBe(false)
    expect(ok(9000, 99000)).toBe(false)
    expect(ok(49000, 1001000)).toBe(false)
  })
  it("Pro phải cao hơn Plus: bằng nhau hoặc thấp hơn → lỗi ở prices.pro", () => {
    const r = updatePricesSchema.safeParse({ prices: { plus: 99000, pro: 99000 }, expected })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]).toMatchObject({ message: "Giá Pro phải cao hơn giá Plus", path: ["prices", "pro"] })
    expect(ok(99000, 50000)).toBe(false)
  })
  it("expected không giới hạn khoảng (giá hiện hành có thể là giá cũ ngoài khoảng)", () => {
    expect(updatePricesSchema.safeParse({ prices: { plus: 49000, pro: 99000 }, expected: { plus: 5000, pro: 99000 } }).success).toBe(true)
  })
})
