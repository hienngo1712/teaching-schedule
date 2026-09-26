import { describe, it, expect } from "vitest"
import { cn, getLevel, calcAttendanceRate } from "@/lib/utils"

describe("cn", () => {
  it("merge tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
  it("filter falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c")
  })
  it("dedup conflicting bg-* classes", () => {
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500")
  })
})

describe("getLevel", () => {
  it("lớp 1–5 → tieu_hoc", () => {
    expect(getLevel(1)).toBe("tieu_hoc")
    expect(getLevel(3)).toBe("tieu_hoc")
    expect(getLevel(5)).toBe("tieu_hoc")
  })
  it("lớp 6–9 → thcs", () => {
    expect(getLevel(6)).toBe("thcs")
    expect(getLevel(9)).toBe("thcs")
  })
  it("lớp 10–12 → thpt", () => {
    expect(getLevel(10)).toBe("thpt")
    expect(getLevel(11)).toBe("thpt")
    expect(getLevel(12)).toBe("thpt")
  })
})

describe("calcAttendanceRate", () => {
  it("2 present / 3 total → ~66.67", () => {
    expect(calcAttendanceRate(2, 3)).toBeCloseTo(66.67, 2)
  })
  it("3 / 3 → 100", () => {
    expect(calcAttendanceRate(3, 3)).toBe(100)
  })
  it("0 / 0 → 0 (không chia cho 0)", () => {
    expect(calcAttendanceRate(0, 0)).toBe(0)
  })
  it("0 / 5 → 0", () => {
    expect(calcAttendanceRate(0, 5)).toBe(0)
  })
})
