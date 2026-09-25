import type { PrismaClient } from "@prisma/client"
import type { BankAccountInput } from "@/lib/schemas/settings"

export async function getBankAccount(
  db: PrismaClient,
  userId: number
): Promise<BankAccountInput | null> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { bankBin: true, bankAccountNumber: true, bankAccountName: true },
  })
  // Thiếu 1 trường thì không tạo được QR → coi như chưa cài.
  if (!u.bankBin || !u.bankAccountNumber || !u.bankAccountName) return null
  return {
    bankBin: u.bankBin,
    bankAccountNumber: u.bankAccountNumber,
    bankAccountName: u.bankAccountName,
  }
}

export async function updateBankAccount(
  db: PrismaClient,
  userId: number,
  input: BankAccountInput | null
): Promise<BankAccountInput | null> {
  await db.user.update({
    where: { id: userId },
    data: {
      bankBin: input?.bankBin ?? null,
      bankAccountNumber: input?.bankAccountNumber ?? null,
      bankAccountName: input?.bankAccountName ?? null,
    },
  })
  return input
}
