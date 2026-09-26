import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { monthlyTuitionFilterSchema, updateSettlementSchema, tuitionNoticeSchema } from "@/lib/schemas/tuition"
import { getMonthlyTuitionStatus, updateSettlement } from "@/server/services/tuition.service"
import { getTuitionNotice } from "@/server/services/tuition-notice.service"

export const tuitionRouter = createTRPCRouter({
  getMonthlyStatus: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input)),

  // Bản chỉ đọc cho màn Báo cáo: tính trong bộ nhớ, không ghi snapshot.
  getMonthlyStatusReadOnly: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input, false)),

  updateSettlement: protectedProcedure
    .input(updateSettlementSchema)
    .mutation(({ ctx, input }) => updateSettlement(ctx.db, ctx.userId, input)),

  // Phiếu báo: chỉ đọc, không ghi snapshot.
  getNotice: protectedProcedure
    .input(tuitionNoticeSchema)
    .query(({ ctx, input }) => getTuitionNotice(ctx.db, ctx.userId, input)),
})
