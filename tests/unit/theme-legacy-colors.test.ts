import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

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

  // Hex Tailwind indigo/violet/purple (kể cả dạng ARGB "FF…" của exceljs) — màu nhấn trước A3 (spec P3).
  const LEGACY_HEX =
    /(?<![0-9a-f])(?:FF)?(4F46E5|4338CA|6366F1|818CF8|A5B4FC|C7D2FE|E0E7FF|EEF2FF|7C3AED|6D28D9|8B5CF6|A78BFA|DDD6FE|EDE9FE|9333EA|A855F7|C084FC|E9D5FF|F3E8FF)(?![0-9a-f])/i
  // Bảng màu MÔN HỌC là dữ liệu người dùng chọn, không phải màu nhấn giao diện (spec P Q6).
  const SUBJECT_COLOR_FILES = ["lib/subject-colors.ts", "lib/schemas/subject.ts", "server/services/subject-defaults.ts"]

  it("src/ không còn hex indigo/violet/purple (trừ bảng màu môn học)", () => {
    const hits = walk(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .filter((f) => !SUBJECT_COLOR_FILES.includes(relative(SRC, f).split(sep).join("/")))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((line, i) => (LEGACY_HEX.test(line) ? [`${relative(SRC, f)}:${i + 1}: ${line.trim()}`] : []))
      )
    expect(hits).toEqual([])
  })
})
