import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { updateBankAccountSchema } from "@/lib/schemas/settings"
import { getBankAccount, updateBankAccount } from "@/server/services/settings.service"
import { recordConsent } from "@/server/services/consent.service"
import { logSecurityEvent } from "@/server/services/security-event.service"

export const settingsRouter = createTRPCRouter({
  getBankAccount: protectedProcedure.query(({ ctx }) => getBankAccount(ctx.db, ctx.userId)),

  updateBankAccount: protectedProcedure
    .input(updateBankAccountSchema)
    .mutation(async ({ ctx, input }) => {
      if (input) await recordConsent(ctx.db, { userId: ctx.userId, scope: "bank_account", ipAddress: ctx.ip })
      const account = input
        ? { bankBin: input.bankBin, bankAccountNumber: input.bankAccountNumber, bankAccountName: input.bankAccountName }
        : null
      const result = await updateBankAccount(ctx.db, ctx.userId, account)
      await logSecurityEvent(ctx.db, { userId: ctx.userId, event: input ? "bank_account_update" : "bank_account_clear", ipAddress: ctx.ip })
      return result
    }),
})
