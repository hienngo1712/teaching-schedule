import { describe, it, expect } from "vitest"
import { studentCreateSchema } from "@/lib/schemas/student"
import { GRADES } from "@/lib/constants"

describe("studentCreateSchema", () => {
  it("✓ accept valid data", () => {
    expect(() =>
      studentCreateSchema.parse({ fullName: "Nguyễn Văn An", grade: 3 })
    ).not.toThrow()
  })

  it("✗ reject empty fullName", () => {
    expect(() => studentCreateSchema.parse({ fullName: "", grade: 3 })).toThrow()
  })

  it("✗ reject fullName 1 ký tự", () => {
    expect(() => studentCreateSchema.parse({ fullName: "A", grade: 3 })).toThrow()
  })

  it("✗ reject grade = 0", () => {
    expect(() =>
      studentCreateSchema.parse({ fullName: "An", grade: 0 })
    ).toThrow()
  })

  it("✓ accept grade = 10 và 12 (THPT)", () => {
    expect(() => studentCreateSchema.parse({ fullName: "An", grade: 10 })).not.toThrow()
    expect(() => studentCreateSchema.parse({ fullName: "An", grade: 12 })).not.toThrow()
  })

  it("✗ reject grade = 13", () => {
    expect(() => studentCreateSchema.parse({ fullName: "An", grade: 13 })).toThrow()
  })

  it("GRADES = 1..12, khớp giới hạn schema", () => {
    expect([...GRADES]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it("✓ accept SĐT VN bắt đầu 0", () => {
    expect(() =>
      studentCreateSchema.parse({
        fullName: "An",
        grade: 3,
        parentPhone: "0901234567",
      })
    ).not.toThrow()
  })

  it("✓ accept SĐT VN bắt đầu +84", () => {
    expect(() =>
      studentCreateSchema.parse({
        fullName: "An",
        grade: 3,
        parentPhone: "+84901234567",
      })
    ).not.toThrow()
  })

  it("✗ reject SĐT định dạng sai", () => {
    expect(() =>
      studentCreateSchema.parse({
        fullName: "An",
        grade: 3,
        parentPhone: "abc123",
      })
    ).toThrow()
  })

  it("✓ trim whitespace fullName", () => {
    const r = studentCreateSchema.parse({ fullName: "  An Bình  ", grade: 3 })
    expect(r.fullName).toBe("An Bình")
  })

  it("✓ parentPhone empty string → undefined", () => {
    const r = studentCreateSchema.parse({
      fullName: "An",
      grade: 3,
      parentPhone: "",
    })
    expect(r.parentPhone).toBeUndefined()
  })
})
