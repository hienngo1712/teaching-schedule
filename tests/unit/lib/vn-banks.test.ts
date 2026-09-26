import { describe, it, expect } from "vitest"
import { VN_BANKS, findBank } from "@/lib/vn-banks"

describe("VN_BANKS", () => {
  it("25 ngân hàng, BIN 6 chữ số, không trùng", () => {
    expect(VN_BANKS).toHaveLength(25)
    VN_BANKS.forEach((b) => expect(b.bin).toMatch(/^\d{6}$/))
    expect(new Set(VN_BANKS.map((b) => b.bin)).size).toBe(25)
    expect(new Set(VN_BANKS.map((b) => b.shortName)).size).toBe(25)
  })

  it("findBank theo BIN", () => {
    expect(findBank("970436")?.shortName).toBe("Vietcombank")
    expect(findBank("970422")?.shortName).toBe("MB")
    expect(findBank("999999")).toBeUndefined()
  })
})
