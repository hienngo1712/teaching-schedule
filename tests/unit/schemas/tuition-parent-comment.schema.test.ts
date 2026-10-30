import { describe, it, expect } from "vitest"
import { parentCommentSchema } from "@/lib/schemas/tuition"

const base = { studentId: 1, year: 2026, month: 10 }

describe("parentCommentSchema (AT)", () => {
  it("✓ cắt khoảng trắng 2 đầu, giữ xuống dòng ở giữa", () => {
    expect(parentCommentSchema.parse({ ...base, parentComment: "  Con ngoan.\nCần luyện thêm.  " }).parentComment).toBe(
      "Con ngoan.\nCần luyện thêm."
    )
  })

  it("✓ chuỗi rỗng hợp lệ (xoá nhận xét)", () => {
    expect(parentCommentSchema.parse({ ...base, parentComment: "" }).parentComment).toBe("")
  })

  it("✓ đúng 2000 ký tự; ✗ 2001 ký tự", () => {
    expect(parentCommentSchema.safeParse({ ...base, parentComment: "a".repeat(2000) }).success).toBe(true)
    expect(parentCommentSchema.safeParse({ ...base, parentComment: "a".repeat(2001) }).success).toBe(false)
  })

  it("✗ thiếu studentId / tháng sai", () => {
    expect(parentCommentSchema.safeParse({ year: 2026, month: 10, parentComment: "x" }).success).toBe(false)
    expect(parentCommentSchema.safeParse({ ...base, month: 13, parentComment: "x" }).success).toBe(false)
  })
})
