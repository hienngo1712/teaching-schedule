import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
import { monthlyTuitionFilterSchema, updateSettlementSchema, tuitionNoticeSchema, setNoticeSentSchema } from "@/lib/schemas/tuition"
import { paymentListSchema } from "@/lib/schemas/payment"
import { ensureMonthlyTuition, getMonthlyTuitionStatus, loadMonthLedgers, updateSettlement, setNoticeSent } from "@/server/services/tuition.service"
import { getTuitionNotice } from "@/server/services/tuition-notice.service"

export const tuitionRouter = createTRPCRouter({
  getMonthlyStatus: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input)),

  // Bản chỉ đọc cho màn Báo cáo: tính trong bộ nhớ, không ghi snapshot.
  getMonthlyStatusReadOnly: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input, false)),

  updateSettlement: planProcedure("payments")
    .input(updateSettlementSchema)
    .mutation(({ ctx, input }) => updateSettlement(ctx.db, ctx.userId, input)),

  // Phiếu báo: chỉ đọc, không ghi snapshot.
  getNotice: planProcedure("tuitionNotice")
    .input(tuitionNoticeSchema)
    .query(({ ctx, input }) => getTuitionNotice(ctx.db, ctx.userId, input, { origin: ctx.origin, returnPath: "/tuition" })),

  setNoticeSent: protectedProcedure
    .input(setNoticeSentSchema)
    .mutation(({ ctx, input }) => setNoticeSent(ctx.db, ctx.userId, input)),

  ledgers: planProcedure("payments")
    .input(paymentListSchema)
    .query(async ({ ctx, input }) => {
      await ensureMonthlyTuition(ctx.db, ctx.userId, input.studentId, input.year, input.month)
      return loadMonthLedgers(ctx.db, ctx.userId, input.studentId, input.year, input.month)
    }),
})
