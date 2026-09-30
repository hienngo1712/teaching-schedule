import { describe, it, expect } from "vitest"
import { VN_BANKS, findBank, searchBanks } from "@/lib/vn-banks"

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

describe("searchBanks", () => {
  it("chuỗi rỗng → đủ số lượng ngân hàng", () => {
    expect(searchBanks("")).toHaveLength(VN_BANKS.length)
    expect(searchBanks("   ")).toHaveLength(VN_BANKS.length)
  })

  it("vcb → [Vietcombank] đứng đầu", () => {
    const res = searchBanks("vcb")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].shortName).toBe("Vietcombank")
  })

  it("VIETCOM, ngoại thương, ngoai thuong → có Vietcombank", () => {
    expect(searchBanks("VIETCOM").some((b) => b.shortName === "Vietcombank")).toBe(true)
    expect(searchBanks("ngoại thương").some((b) => b.shortName === "Vietcombank")).toBe(true)
    expect(searchBanks("ngoai thuong").some((b) => b.shortName === "Vietcombank")).toBe(true)
  })

  it("quan doi → có MB", () => {
    expect(searchBanks("quan doi").some((b) => b.shortName === "MB")).toBe(true)
  })

  it("970436 → Vietcombank", () => {
    const res = searchBanks("970436")
    expect(res.some((b) => b.shortName === "Vietcombank")).toBe(true)
  })

  it("zzz → []", () => {
    expect(searchBanks("zzz")).toEqual([])
  })
})
