import { z } from "zod"
import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
import { hasFeature } from "@/lib/plans"
import {
  incomeDetailSchema,
  monthInputSchema,
  placePaymentCreateSchema,
  placeRateSetSchema,
  timesheetMonthSchema,
} from "@/lib/schemas/timesheet"
import { getUserPlan } from "@/server/services/plan.service"
import {
  createPlacePayment,
  deletePlacePayment,
  getIncomeDetail,
  getIncomeLast12,
  getIncomeMonth,
  getPlaceRateHistory,
  getTimesheetMonth,
  setPlaceRate,
} from "@/server/services/timesheet.service"

// Bảng công: gói Plus (spec AM §4.1).
export const timesheetRouter = createTRPCRouter({
  month: planProcedure("timesheet")
    .input(timesheetMonthSchema)
    .query(({ ctx, input }) => getTimesheetMonth(ctx.db, ctx.userId, input)),
})

// Xem thu nhập dự kiến: mọi gói; lịch sử nhận chỉ trả khi có gói Plus.
export const incomeRouter = createTRPCRouter({
  month: protectedProcedure.input(monthInputSchema).query(({ ctx, input }) => getIncomeMonth(ctx.db, ctx.userId, input)),

  // Biểu đồ 12 tháng (spec AN §4): gói Pro.
  last12: planProcedure("income12m").query(({ ctx }) => getIncomeLast12(ctx.db, ctx.userId)),

  detail: protectedProcedure.input(incomeDetailSchema).query(async ({ ctx, input }) => {
    const { plan } = await getUserPlan(ctx.db, ctx.userId)
    return getIncomeDetail(ctx.db, ctx.userId, input, hasFeature(plan, "placePayments"))
  }),
})

// Đơn giá nơi dạy: mọi gói (form Nơi dạy).
export const placeRateRouter = createTRPCRouter({
  set: protectedProcedure.input(placeRateSetSchema).mutation(({ ctx, input }) => setPlaceRate(ctx.db, ctx.userId, input)),

  history: protectedProcedure
    .input(z.object({ placeId: z.number().int().positive() }))
    .query(({ ctx, input }) => getPlaceRateHistory(ctx.db, ctx.userId, input.placeId)),
})

// Ghi nhận đã nhận tiền từ nơi dạy: gói Plus.
export const placePaymentRouter = createTRPCRouter({
  create: planProcedure("placePayments")
    .input(placePaymentCreateSchema)
    .mutation(({ ctx, input }) => createPlacePayment(ctx.db, ctx.userId, input)),

  delete: planProcedure("placePayments")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => deletePlacePayment(ctx.db, ctx.userId, input.id)),
})
