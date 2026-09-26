import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { updateBankAccountSchema } from "@/lib/schemas/settings"
import { getBankAccount, updateBankAccount } from "@/server/services/settings.service"

export const settingsRouter = createTRPCRouter({
  getBankAccount: protectedProcedure.query(({ ctx }) => getBankAccount(ctx.db, ctx.userId)),

  updateBankAccount: protectedProcedure
    .input(updateBankAccountSchema)
    .mutation(({ ctx, input }) => updateBankAccount(ctx.db, ctx.userId, input)),
})
