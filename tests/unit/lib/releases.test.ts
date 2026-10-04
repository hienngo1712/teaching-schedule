import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import {
  RELEASES, compareVersions, latestNotifyRelease, hasUnseenRelease, isKnownRelease, shortVersion, formatReleaseDate,
} from "@/lib/releases"

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }

describe("releases (spec W §5.1)", () => {
  it("bản đầu danh sách = version package.json: nâng version phải thêm mục cập nhật", () => {
    expect(RELEASES[0].version).toBe(pkg.version)
  })

  it("sắp mới → cũ, không trùng version, ngày dạng YYYY-MM-DD, mỗi bản ≥ 1 mục", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0)
    }
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.items.length).toBeGreaterThan(0)
      expect(r.version.length).toBeLessThanOrEqual(20)
    }
  })

  it("compareVersions so theo số, không theo chữ", () => {
    expect(compareVersions("0.10.0", "0.9.5")).toBeGreaterThan(0)
    expect(compareVersions("0.9.5", "0.10.0")).toBeLessThan(0)
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
    expect(compareVersions("0.10", "0.10.0")).toBe(0)
  })

  it("hasUnseenRelease: null = chưa xem gì; đã xem bản notify mới nhất → false", () => {
    const latest = latestNotifyRelease()!
    expect(hasUnseenRelease(null)).toBe(true)
    expect(hasUnseenRelease(latest.version)).toBe(false)
    expect(hasUnseenRelease("0.0.1")).toBe(true)
    expect(hasUnseenRelease("99.0.0")).toBe(false)
  })

  it("isKnownRelease, shortVersion, formatReleaseDate", () => {
    expect(isKnownRelease(RELEASES[0].version)).toBe(true)
    expect(isKnownRelease("0.0.0-la")).toBe(false)
    expect(shortVersion("0.10.0")).toBe("v0.10")
    expect(formatReleaseDate("2026-10-05")).toBe("05/10/2026")
  })
})
