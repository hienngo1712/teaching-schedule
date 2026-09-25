import { describe, it, expect } from "vitest"
import { paymentCreateSchema, paymentUpdateSchema } from "@/lib/schemas/payment"

const base = {
  studentId: 1,
  year: 2026,
  month: 5,
  amount: 100000,
  paidAt: "2026-05-12",
  method: "cash" as const,
}

describe("paymentCreateSchema", () => {
  it("✓ hợp lệ, không gửi note → note undefined", () => {
    expect(paymentCreateSchema.parse(base).note).toBeUndefined()
  })

  it("✗ amount < 1 hoặc không nguyên", () => {
    expect(paymentCreateSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, amount: 1.5 }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, amount: 1 }).success).toBe(true)
  })

  it("✗ amount vượt 1 tỷ (tránh tràn INTEGER Postgres → 500)", () => {
    expect(paymentCreateSchema.safeParse({ ...base, amount: 1_000_000_000 }).success).toBe(true)
    expect(paymentCreateSchema.safeParse({ ...base, amount: 1_000_000_001 }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, amount: 3_000_000_000 }).success).toBe(false)
  })

  it("✗ ngày sai dạng hoặc không có thật", () => {
    for (const paidAt of ["2026-5-12", "12/05/2026", "2026-13-01", "2026-02-30", ""]) {
      expect(paymentCreateSchema.safeParse({ ...base, paidAt }).success).toBe(false)
    }
  })

  it("✗ method ngoài danh sách", () => {
    expect(paymentCreateSchema.safeParse({ ...base, method: "card" }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, method: "transfer" }).success).toBe(true)
  })

  it("✓ note rỗng/khoảng trắng → null; có chữ → trim", () => {
    expect(paymentCreateSchema.parse({ ...base, note: "" }).note).toBeNull()
    expect(paymentCreateSchema.parse({ ...base, note: "   " }).note).toBeNull()
    expect(paymentCreateSchema.parse({ ...base, note: "  Mẹ đóng  " }).note).toBe("Mẹ đóng")
  })

  it("✗ note dài hơn 500 ký tự", () => {
    expect(paymentCreateSchema.safeParse({ ...base, note: "a".repeat(501) }).success).toBe(false)
  })
})

describe("paymentUpdateSchema", () => {
  it("không gửi note → undefined (không được xoá ghi chú cũ)", () => {
    expect(paymentUpdateSchema.parse({ id: 1, data: { amount: 5000 } }).data.note).toBeUndefined()
  })

  it("✗ amount vượt 1 tỷ", () => {
    expect(paymentUpdateSchema.safeParse({ id: 1, data: { amount: 1_000_000_001 } }).success).toBe(false)
  })

  it("note rỗng → null (xoá ghi chú)", () => {
    expect(paymentUpdateSchema.parse({ id: 1, data: { note: "" } }).data.note).toBeNull()
  })
})
