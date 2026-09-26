import { createTRPCRouter, planProcedure } from "@/server/trpc"
import {
  paymentCreateSchema,
  paymentDeleteSchema,
  paymentListSchema,
  paymentUpdateSchema,
} from "@/lib/schemas/payment"
import {
  createPayment,
  deletePayment,
  listPayments,
  updatePayment,
} from "@/server/services/payment.service"

export const paymentRouter = createTRPCRouter({
  list: planProcedure("payments")
    .input(paymentListSchema)
    .query(({ ctx, input }) => listPayments(ctx.db, ctx.userId, input)),

  create: planProcedure("payments")
    .input(paymentCreateSchema)
    .mutation(({ ctx, input }) => createPayment(ctx.db, ctx.userId, input)),

  update: planProcedure("payments")
    .input(paymentUpdateSchema)
    .mutation(({ ctx, input }) => updatePayment(ctx.db, ctx.userId, input.id, input.data)),

  delete: planProcedure("payments")
    .input(paymentDeleteSchema)
    .mutation(({ ctx, input }) => deletePayment(ctx.db, ctx.userId, input.id)),
})
