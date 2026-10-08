import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { TOURS } from "@/lib/tours"

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return tsxFiles(p)
    return p.endsWith(".tsx") ? [p] : []
  })
}

const source = tsxFiles(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8")).join("\n")

describe("data-tour", () => {
  // Đổi giao diện mà mất data-tour thì tour gãy âm thầm; test này báo ngay.
  it("mọi target trong TOURS có trong giao diện", () => {
    const targets = new Set(Object.values(TOURS).flatMap((t) => t.steps.map((s) => s.target)).filter((x): x is string => x !== null))
    const missing = [...targets].filter((x) => !source.includes(`data-tour="${x}"`) && !source.includes(`firstRowTour="${x}"`))
    expect(missing).toEqual([])
  })
})
