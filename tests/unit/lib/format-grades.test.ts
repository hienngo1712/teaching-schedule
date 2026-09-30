import { describe, it, expect } from "vitest"
import { formatGrades } from "@/lib/format-grades"

describe("formatGrades", () => {
  it.each([
    [[], "Lớp", false, ""],
    [[5], "Lớp", false, "Lớp 5"],
    [[4, 5], "Lớp", false, "Lớp 4, 5"],
    [[3, 4, 5], "Lớp", false, "Lớp 3–5"],
    [[3, 4, 5, 8], "Lớp", false, "Lớp 3–5, 8"],
    [[1, 3, 5], "Lớp", false, "Lớp 1, 3, 5"],
    [[5], "Lớp", true, "L5"],
    [[3, 4, 5], "Lớp", true, "L3–5"],
    [[5], "Grade", false, "Grade 5"],
    [[4, 5], "Grade", true, "G4, 5"],
  ])("%j %s compact=%s → %s", (g, word, compact, want) => {
    expect(formatGrades(g as number[], word as string, compact as boolean)).toBe(want)
  })
})
