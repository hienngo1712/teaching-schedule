// QA gói AT: ca biên DEV chưa phủ (schema, mã hoá cột parentComment).
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import { parentCommentSchema } from "@/lib/schemas/tuition"
import { decryptResult, encryptWriteArgs } from "@/server/crypto/prisma-encryption"
import { decryptField, isEncrypted } from "@/server/crypto/field-crypto"

const base = { studentId: 1, year: 2026, month: 10 }

describe("parentCommentSchema — ca biên (QA AT)", () => {
  it("chỉ có khoảng trắng / xuống dòng → thành chuỗi rỗng (xoá nhận xét)", () => {
    expect(parentCommentSchema.parse({ ...base, parentComment: "  \n\t  " }).parentComment).toBe("")
  })

  it("cắt khoảng trắng trước khi đếm: 2000 ký tự + khoảng trắng 2 đầu vẫn hợp lệ", () => {
    const r = parentCommentSchema.safeParse({ ...base, parentComment: `   ${"a".repeat(2000)}\n ` })
    expect(r.success).toBe(true)
  })

  it("✗ thiếu parentComment / không phải chuỗi", () => {
    expect(parentCommentSchema.safeParse(base).success).toBe(false)
    expect(parentCommentSchema.safeParse({ ...base, parentComment: null }).success).toBe(false)
  })

  it("giữ nguyên thẻ HTML dạng chữ (chống XSS nằm ở chỗ render, không lọc ở schema)", () => {
    expect(parentCommentSchema.parse({ ...base, parentComment: "<script>x</script>" }).parentComment).toBe("<script>x</script>")
  })
})

describe("Mã hoá MonthlyTuition.parentComment (QA AT)", () => {
  const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
  beforeEach(() => {
    process.env.DATA_ENCRYPTION_KEYS = `u1:${randomBytes(32).toString("base64")}`
    process.env.DATA_ENCRYPTION_ACTIVE_KID = "u1"
  })
  afterAll(() => {
    process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
    process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
  })

  it("update (đường saveParentComment) ghi ciphertext, đọc ra lại bản rõ có xuống dòng", () => {
    const text = "Con tiến bộ.\nCần luyện đọc hiểu."
    const out = encryptWriteArgs({ where: { id: 99 }, data: { parentComment: text }, select: { parentComment: true } })
    expect(isEncrypted(out.data.parentComment)).toBe(true)
    expect(decryptField(out.data.parentComment as string, "parentComment")).toBe(text)
    expect(decryptResult({ parentComment: out.data.parentComment }).parentComment).toBe(text)
  })

  it("null (xoá nhận xét) giữ nguyên null, không mã hoá", () => {
    const out = encryptWriteArgs({ where: { id: 99 }, data: { parentComment: null } })
    expect(out.data.parentComment).toBeNull()
  })

  it("ciphertext gắn với tên trường: không giải mã chéo được sang `notes`", () => {
    const enc = encryptWriteArgs({ data: { parentComment: "x" } }).data.parentComment as string
    expect(() => decryptField(enc, "notes")).toThrow()
  })
})
