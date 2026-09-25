import { describe, it, expect } from "vitest"
import { formatVnDate } from "@/lib/payment-notes"

describe("formatVnDate", () => {
  it("đổi sang ngày theo giờ VN (UTC+7), không dùng giờ server", () => {
    // 2026-08-01T18:30:00Z = 01:30 ngày 02/08 giờ VN
    expect(formatVnDate(new Date("2026-08-01T18:30:00Z"))).toBe("02/08/2026")
  })
})
