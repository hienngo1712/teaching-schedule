import { describe, it, expect } from "vitest"
import { byGradeThenName, compareViName, nameMatches, normalizeForSearch } from "@/lib/name-search"

describe("name-search (spec O 6.4)", () => {
  it("không phân biệt hoa thường, phân biệt dấu như ILIKE cũ", () => {
    expect(nameMatches("Nguyễn Văn An", "AN")).toBe(true)
    expect(nameMatches("Nguyễn Văn An", "văn a")).toBe(true)
    expect(nameMatches("Trần Thị Ánh", "an")).toBe(false)
    expect(nameMatches("Trần Thị Ánh", "ÁNH")).toBe(true)
  })

  it("NFC và NFD khớp nhau", () => {
    const nfd = "Nguyễn".normalize("NFD")
    expect(nameMatches("Nguyễn Văn An", nfd)).toBe(true)
    expect(normalizeForSearch(nfd)).toBe(normalizeForSearch("Nguyễn"))
  })

  it("term rỗng hoặc undefined khớp tất cả", () => {
    expect(nameMatches("Bất kỳ", "")).toBe(true)
    expect(nameMatches("Bất kỳ", undefined)).toBe(true)
  })

  it("sắp theo tiếng Việt: D trước Đ, A trước Ă/Â", () => {
    expect(["Đức", "Dũng", "Anh"].sort(compareViName)).toEqual(["Anh", "Dũng", "Đức"])
    expect(compareViName("Ân", "An")).toBeGreaterThan(0)
  })

  it("byGradeThenName: lớp trước, rồi tên, trùng tên theo id", () => {
    const rows = [
      { id: 3, grade: 5, fullName: "An" },
      { id: 2, grade: 3, fullName: "Bình" },
      { id: 9, grade: 3, fullName: "An" },
      { id: 1, grade: 3, fullName: "An" },
    ]
    expect(rows.sort(byGradeThenName).map((r) => r.id)).toEqual([1, 9, 2, 3])
  })
})
