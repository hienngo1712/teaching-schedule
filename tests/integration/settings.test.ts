import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const BANK = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}

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
    await caller.settings.updateBankAccount(BANK)
    expect(await caller.settings.getBankAccount()).toEqual(BANK)
  })

  it("✓ lưu null → xoá cả 3 cột", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    await caller.settings.updateBankAccount(null)
    expect(await caller.settings.getBankAccount()).toBeNull()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect([u.bankBin, u.bankAccountNumber, u.bankAccountName]).toEqual([null, null, null])
  })

  it("✗ BIN ngoài danh sách → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.settings.updateBankAccount({ ...BANK, bankBin: "999999" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✓ thiếu 1 cột trong DB → coi như chưa cài", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    await db.user.update({ where: { username: "teacher" }, data: { bankAccountName: null } })
    expect(await caller.settings.getBankAccount()).toBeNull()
  })

  it("✓ user khác không thấy của nhau", async () => {
    const caller = await getAuthedCaller()
    const caller2 = await getAuthedCaller("teacher2")
    await caller.settings.updateBankAccount(BANK)
    expect(await caller2.settings.getBankAccount()).toBeNull()
  })
})
