import { adminProcedure, createTRPCRouter } from "@/server/trpc"
import { orderIdSchema, rejectOrderSchema, setPlanSchema, updatePricesSchema } from "@/lib/schemas/plan"
import { adminSetPlan, approveOrder, getAdminOverview, getOrderHistory, rejectOrder } from "@/server/services/plan-admin.service"
import { getMonthlyPrices, getPriceHistory, updatePrices } from "@/server/services/plan-price.service"

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
})
