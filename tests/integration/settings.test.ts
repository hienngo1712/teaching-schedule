import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { CONSENT_ACCEPTED } from "@/lib/consent"

const BANK = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}
const BANK_INPUT = { ...BANK, consent: CONSENT_ACCEPTED }

describe("settings.bankAccount", () => {
  beforeEach(async () => {
    await db.user.updateMany({
      data: { bankBin: null, bankAccountNumber: null, bankAccountName: null },
    })
  })

  it("✓ chưa cài → null", async () => {
    const caller = await getAuthedCaller()
    expect(await caller.settings.getBankAccount()).toBeNull()
  })

  it("✓ lưu rồi đọc lại đúng", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK_INPUT)
    expect(await caller.settings.getBankAccount()).toEqual(BANK)
  })

  it("✓ lưu null → xoá cả 3 cột", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK_INPUT)
    await caller.settings.updateBankAccount(null)
    expect(await caller.settings.getBankAccount()).toBeNull()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect([u.bankBin, u.bankAccountNumber, u.bankAccountName]).toEqual([null, null, null])
  })

  it("✗ BIN ngoài danh sách → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.settings.updateBankAccount({ ...BANK_INPUT, bankBin: "999999" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✓ thiếu 1 cột trong DB → coi như chưa cài", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK_INPUT)
    await db.user.update({ where: { username: "teacher" }, data: { bankAccountName: null } })
    expect(await caller.settings.getBankAccount()).toBeNull()
  })

  it("✓ user khác không thấy của nhau", async () => {
    const caller = await getAuthedCaller()
    const caller2 = await getAuthedCaller("teacher2")
    await caller.settings.updateBankAccount(BANK_INPUT)
    expect(await caller2.settings.getBankAccount()).toBeNull()
  })
})
