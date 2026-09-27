import { describe, it, expect } from "vitest"
import { createOrderSchema } from "@/lib/schemas/plan"

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
