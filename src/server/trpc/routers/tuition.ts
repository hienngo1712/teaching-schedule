import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { monthlyTuitionFilterSchema, updatePaymentSchema } from "@/lib/schemas/tuition"
import { getMonthlyTuitionStatus, updateTuitionPayment } from "@/server/services/tuition.service"

export const tuitionRouter = createTRPCRouter({
  getMonthlyStatus: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input)),

  // Bản CHỈ ĐỌC cho màn báo cáo / thẻ tóm tắt: tính đủ trong bộ nhớ nhưng không
  // materialize snapshot. Tránh việc chỉ mở xem báo cáo cũng ghi hàng loạt row
  // MonthlyTuition.
  getMonthlyStatusReadOnly: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input, false)),

  updatePayment: protectedProcedure
    .input(updatePaymentSchema)
    .mutation(({ ctx, input }) => updateTuitionPayment(ctx.db, ctx.userId, input)),
})
