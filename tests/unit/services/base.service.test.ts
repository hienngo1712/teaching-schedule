import { describe, it, expect } from "vitest"
import { TRPCError } from "@trpc/server"
import { assertOwnership } from "@/server/services/_base.service"

describe("assertOwnership", () => {
  it("✗ null record → throw NOT_FOUND", () => {
    try {
      assertOwnership(null, 1)
      expect.fail("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError)
      expect((e as TRPCError).code).toBe("NOT_FOUND")
    }
  })

  it("✗ undefined record → throw NOT_FOUND", () => {
    expect(() => assertOwnership(undefined, 1)).toThrow(TRPCError)
  })

  it("✗ record.userId khác → throw NOT_FOUND (không phải FORBIDDEN)", () => {
    try {
      assertOwnership({ userId: 2 }, 1)
      expect.fail("should have thrown")
    } catch (e) {
      expect((e as TRPCError).code).toBe("NOT_FOUND")
    }
  })

  it("✓ record.userId trùng → không throw", () => {
    expect(() => assertOwnership({ userId: 1 }, 1)).not.toThrow()
  })

  it("✓ assert narrows type — không cần check sau khi gọi", () => {
    const record: { userId: number } | null = { userId: 5 }
    assertOwnership(record, 5)
    // TypeScript: sau dòng trên, record được narrow thành non-null
    expect(record.userId).toBe(5)
  })
})
