import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { createOrderSchema, orderIdSchema } from "@/lib/schemas/plan"
import { cancelOrder, createOrder, getMyPlan } from "@/server/services/plan.service"

export const planRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => getMyPlan(ctx.db, ctx.userId, ctx.session.user.username)),

  createOrder: protectedProcedure
    .input(createOrderSchema)
    .mutation(({ ctx, input }) => createOrder(ctx.db, ctx.userId, input)),

  cancelOrder: protectedProcedure
    .input(orderIdSchema)
    .mutation(({ ctx, input }) => cancelOrder(ctx.db, ctx.userId, input.id)),
})
