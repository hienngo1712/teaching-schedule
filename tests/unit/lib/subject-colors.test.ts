import { describe, it, expect } from "vitest"
import { SUBJECT_COLORS, pickNextColor } from "@/lib/subject-colors"

describe("pickNextColor", () => {
  it("chưa dùng màu nào → màu đầu bảng", () => {
    expect(pickNextColor([])).toBe(SUBJECT_COLORS[0])
  })

  it("bỏ qua màu đã dùng, không phân biệt hoa thường", () => {
    expect(pickNextColor(["#4f46e5", SUBJECT_COLORS[1]])).toBe(SUBJECT_COLORS[2])
  })

  it("đã dùng hết → quay về màu đầu bảng", () => {
    expect(pickNextColor([...SUBJECT_COLORS])).toBe(SUBJECT_COLORS[0])
  })

  it("bảng có 10 màu hex không trùng", () => {
    expect(SUBJECT_COLORS).toHaveLength(10)
    expect(new Set(SUBJECT_COLORS).size).toBe(10)
    SUBJECT_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/))
  })
})
