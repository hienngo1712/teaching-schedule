import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const SRC = join(process.cwd(), "src")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe("A3 — một màu nhấn", () => {
  it("src/ không còn class indigo/violet/purple", () => {
    const hits = walk(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((line, i) =>
            /(indigo|violet|purple)-\d/.test(line) ? [`${relative(SRC, f)}:${i + 1}: ${line.trim()}`] : []
          )
      )
    expect(hits).toEqual([])
  })
})
