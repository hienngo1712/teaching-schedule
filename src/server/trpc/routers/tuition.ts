import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { monthlyTuitionFilterSchema, updatePaymentSchema, updateSettlementSchema } from "@/lib/schemas/tuition"
import { getMonthlyTuitionStatus, updateSettlement, updateTuitionPayment } from "@/server/services/tuition.service"

export const tuitionRouter = createTRPCRouter({
  getMonthlyStatus: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input)),

  // Bản chỉ đọc cho màn Báo cáo: tính trong bộ nhớ, không ghi snapshot.
  getMonthlyStatusReadOnly: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input, false)),

  updatePayment: protectedProcedure
    .input(updatePaymentSchema)
    .mutation(({ ctx, input }) => updateTuitionPayment(ctx.db, ctx.userId, input)),

  updateSettlement: protectedProcedure
    .input(updateSettlementSchema)
    .mutation(({ ctx, input }) => updateSettlement(ctx.db, ctx.userId, input)),
})
