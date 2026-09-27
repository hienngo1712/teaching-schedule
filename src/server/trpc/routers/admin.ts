import { adminProcedure, createTRPCRouter } from "@/server/trpc"
import {
  orderIdSchema,
  rejectOrderSchema,
  setPlanSchema,
  setUserTrialSchema,
  updatePricesSchema,
  updateTrialDaysSchema,
  userIdSchema,
} from "@/lib/schemas/plan"
import { resetPasswordSchema } from "@/lib/schemas/auth"
import { adminSetPlan, approveOrder, getAdminOverview, getOrderHistory, rejectOrder } from "@/server/services/plan-admin.service"
import { getMonthlyPrices, getPriceHistory, updatePrices } from "@/server/services/plan-price.service"
import { adminResetPassword } from "@/server/services/password-reset.service"
import { getDefaultTrialDays, getTrialHistory, getUserTrialChanges, setUserTrialDays, updateDefaultTrialDays } from "@/server/services/trial.service"

export const adminRouter = createTRPCRouter({
  overview: adminProcedure.query(({ ctx }) => getAdminOverview(ctx.db)),
  orderHistory: adminProcedure.query(({ ctx }) => getOrderHistory(ctx.db)),

  prices: adminProcedure.query(async ({ ctx }) => {
    const [monthly, history] = await Promise.all([getMonthlyPrices(ctx.db), getPriceHistory(ctx.db)])
    return { monthly, history }
  }),

  approveOrder: adminProcedure
    .input(orderIdSchema)
    .mutation(({ ctx, input }) => approveOrder(ctx.db, ctx.session.user.username, input.id)),

  rejectOrder: adminProcedure
    .input(rejectOrderSchema)
    .mutation(({ ctx, input }) => rejectOrder(ctx.db, ctx.session.user.username, input.id, input.note)),

  setPlan: adminProcedure
    .input(setPlanSchema)
    .mutation(({ ctx, input }) => adminSetPlan(ctx.db, ctx.session.user.username, input)),

  updatePrices: adminProcedure
    .input(updatePricesSchema)
    .mutation(({ ctx, input }) => updatePrices(ctx.db, ctx.session.user.username, input)),

  trialSettings: adminProcedure.query(async ({ ctx }) => {
    const [days, history] = await Promise.all([getDefaultTrialDays(ctx.db), getTrialHistory(ctx.db)])
    return { days, history }
  }),

  updateTrialDays: adminProcedure
    .input(updateTrialDaysSchema)
    .mutation(({ ctx, input }) => updateDefaultTrialDays(ctx.db, ctx.session.user.username, input)),

  setUserTrial: adminProcedure
    .input(setUserTrialSchema)
    .mutation(({ ctx, input }) => setUserTrialDays(ctx.db, ctx.session.user.username, input)),

  userTrialChanges: adminProcedure.input(userIdSchema).query(({ ctx, input }) => getUserTrialChanges(ctx.db, input.userId)),

  resetPassword: adminProcedure
    .input(resetPasswordSchema)
    .mutation(({ ctx, input }) => adminResetPassword(ctx.db, ctx.session.user.username, input.userId)),
})
