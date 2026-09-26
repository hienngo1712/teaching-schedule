import { describe, it, expect } from "vitest"
import { bankAccountSchema, updateBankAccountSchema } from "@/lib/schemas/settings"

const valid = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}

describe("bankAccountSchema", () => {
  it("hợp lệ, giữ số 0 đầu, trim số TK và tên", () => {
    const r = bankAccountSchema.parse({
      ...valid,
      bankAccountNumber: " 0011001234567 ",
      bankAccountName: "  NGUYEN VAN A ",
    })
    expect(r).toEqual(valid)
  })

  it("BIN ngoài VN_BANKS → lỗi", () => {
    expect(bankAccountSchema.safeParse({ ...valid, bankBin: "999999" }).success).toBe(false)
  })

  it("số TK có dấu cách ở giữa, quá 19 ký tự, dưới 4 ký tự → lỗi", () => {
    for (const n of ["0011 001234", "1".repeat(20), "123"]) {
      expect(bankAccountSchema.safeParse({ ...valid, bankAccountNumber: n }).success).toBe(false)
    }
  })

  it("tên rỗng hoặc quá 50 ký tự → lỗi", () => {
    expect(bankAccountSchema.safeParse({ ...valid, bankAccountName: "   " }).success).toBe(false)
    expect(bankAccountSchema.safeParse({ ...valid, bankAccountName: "A".repeat(51) }).success).toBe(false)
  })

  it("updateBankAccountSchema nhận null (= xoá)", () => {
    expect(updateBankAccountSchema.parse(null)).toBeNull()
  })
})
