import { describe, it, expect } from "vitest"
import { shouldInvalidateAll, SKIP_GLOBAL_INVALIDATE } from "@/components/providers/TRPCProvider"

describe("shouldInvalidateAll (spec AC §5.1)", () => {
  it("mặc định làm mới toàn bộ", () => {
    expect(shouldInvalidateAll(undefined)).toBe(true)
    expect(shouldInvalidateAll({})).toBe(true)
    expect(shouldInvalidateAll({ skipGlobalInvalidate: false })).toBe(true)
  })
  it("mutation chat có meta thì bỏ qua", () => {
    expect(shouldInvalidateAll(SKIP_GLOBAL_INVALIDATE)).toBe(false)
  })
})
