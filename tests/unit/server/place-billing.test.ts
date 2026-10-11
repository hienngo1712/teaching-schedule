import { describe, it, expect } from "vitest"
import { resolvePlaceBilling } from "@/lib/billing"

// Spec AL §3: cách tính tiền của nơi theo thời gian, giống resolveBilling.
describe("resolvePlaceBilling", () => {
  it("không có dòng nào → per_student", () => {
    expect(resolvePlaceBilling([], 24320)).toBe("per_student")
  })

  it("đổi sang per_session từ tháng 24321: tháng trước giữ per_student", () => {
    const changes = [
      { fromKey: 0, billing: "per_student" },
      { fromKey: 24321, billing: "per_session" },
    ]
    expect(resolvePlaceBilling(changes, 24320)).toBe("per_student")
    expect(resolvePlaceBilling(changes, 24321)).toBe("per_session")
    expect(resolvePlaceBilling(changes, 24330)).toBe("per_session")
  })

  it("không phụ thuộc thứ tự dòng; lấy fromKey lớn nhất ≤ key", () => {
    const changes = [
      { fromKey: 24325, billing: "per_student" },
      { fromKey: 0, billing: "per_session" },
    ]
    expect(resolvePlaceBilling(changes, 24324)).toBe("per_session")
    expect(resolvePlaceBilling(changes, 24325)).toBe("per_student")
  })
})
