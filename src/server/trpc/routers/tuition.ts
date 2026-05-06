import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { monthlyTuitionFilterSchema, updatePaymentSchema } from "@/lib/schemas/tuition"
import { getMonthlyTuitionStatus, updateTuitionPayment } from "@/server/services/tuition.service"

export const tuitionRouter = createTRPCRouter({
  getMonthlyStatus: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input)),

  updatePayment: protectedProcedure
    .input(updatePaymentSchema)
    .mutation(({ ctx, input }) => updateTuitionPayment(ctx.db, ctx.userId, input)),
})
