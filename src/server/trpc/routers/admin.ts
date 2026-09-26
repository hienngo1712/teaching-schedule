import { adminProcedure, createTRPCRouter } from "@/server/trpc"
import { orderIdSchema, rejectOrderSchema, setPlanSchema } from "@/lib/schemas/plan"
import { adminSetPlan, approveOrder, getAdminOverview, rejectOrder } from "@/server/services/plan-admin.service"

export const adminRouter = createTRPCRouter({
  overview: adminProcedure.query(({ ctx }) => getAdminOverview(ctx.db)),

  approveOrder: adminProcedure
    .input(orderIdSchema)
    .mutation(({ ctx, input }) => approveOrder(ctx.db, ctx.session.user.username, input.id)),

  rejectOrder: adminProcedure
    .input(rejectOrderSchema)
    .mutation(({ ctx, input }) => rejectOrder(ctx.db, ctx.session.user.username, input.id, input.note)),

  setPlan: adminProcedure
    .input(setPlanSchema)
    .mutation(({ ctx, input }) => adminSetPlan(ctx.db, ctx.session.user.username, input)),
})
