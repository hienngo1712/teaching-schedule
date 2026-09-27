import { describe, it, expect } from "vitest"
import { sessionCopyMonthPreviewSchema, sessionCopyMonthSchema } from "@/lib/schemas/session"

const base = { source: { year: 2030, month: 1 }, from: { year: 2030, month: 2 }, months: 1 }

describe("sessionCopyMonthPreviewSchema", () => {
  it("✓ hợp lệ, patternKeys không bắt buộc, được rỗng", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse(base).success).toBe(true)
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, patternKeys: [] }).success).toBe(true)
  })
  it("✓ from = source + 12, qua năm", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, source: { year: 2030, month: 11 }, from: { year: 2031, month: 11 } }).success).toBe(true)
  })
  it("✗ from ≤ source", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, from: { year: 2030, month: 1 } }).success).toBe(false)
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, from: { year: 2029, month: 12 } }).success).toBe(false)
  })
  it("✗ from > source + 12", () => {
    const r = sessionCopyMonthPreviewSchema.safeParse({ ...base, from: { year: 2031, month: 2 } })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(["from"])
  })
  it("✗ months = 0 hoặc 4", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, months: 0 }).success).toBe(false)
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, months: 4 }).success).toBe(false)
  })
  it("✗ key dài quá 40 ký tự", () => {
    expect(sessionCopyMonthPreviewSchema.safeParse({ ...base, patternKeys: ["x".repeat(41)] }).success).toBe(false)
  })
})

describe("sessionCopyMonthSchema", () => {
  it("✓ có ít nhất 1 key", () => {
    expect(sessionCopyMonthSchema.safeParse({ ...base, patternKeys: ["0|17:00|19:00|1"] }).success).toBe(true)
  })
  it("✗ thiếu patternKeys hoặc patternKeys rỗng", () => {
    expect(sessionCopyMonthSchema.safeParse(base).success).toBe(false)
    expect(sessionCopyMonthSchema.safeParse({ ...base, patternKeys: [] }).success).toBe(false)
  })
  it("✗ cùng luật tháng như xem trước", () => {
    expect(sessionCopyMonthSchema.safeParse({ ...base, from: { year: 2030, month: 1 }, patternKeys: ["k"] }).success).toBe(false)
  })
})
