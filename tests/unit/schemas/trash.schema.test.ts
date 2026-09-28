import { describe, it, expect } from "vitest"
import { TRASH_TYPES, trashListSchema, trashRestoreSchema } from "@/lib/schemas/trash"

describe("trash schema", () => {
  it("4 loại đúng thứ tự hiển thị", () => {
    expect(TRASH_TYPES).toEqual(["session", "student", "payment", "subject"])
  })
  it("list: mặc định page 1, limit 20; limit > 100 bị chặn; loại lạ bị chặn", () => {
    expect(trashListSchema.parse({ type: "session" })).toEqual({ type: "session", page: 1, limit: 20 })
    expect(trashListSchema.safeParse({ type: "session", limit: 101 }).success).toBe(false)
    expect(trashListSchema.safeParse({ type: "user" }).success).toBe(false)
  })
  it("restore: id nguyên dương", () => {
    expect(trashRestoreSchema.safeParse({ type: "payment", id: 0 }).success).toBe(false)
    expect(trashRestoreSchema.parse({ type: "payment", id: 5 })).toEqual({ type: "payment", id: 5 })
  })
})
