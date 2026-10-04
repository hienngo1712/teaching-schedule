import { createTRPCRouter, planProcedure } from "@/server/trpc"
import {
  paymentBatchSchema,
  paymentCreateSchema,
  paymentDeleteSchema,
  paymentListSchema,
  paymentRecordSchema,
  paymentUpdateBatchSchema,
  paymentUpdateSchema,
} from "@/lib/schemas/payment"
import {
  createPayment,
  deleteBatch,
  deletePayment,
  listBatches,
  listPayments,
  recordPayment,
  updateBatch,
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

  record: planProcedure("payments")
    .input(paymentRecordSchema)
    .mutation(({ ctx, input }) => recordPayment(ctx.db, ctx.userId, input)),

  listBatches: planProcedure("payments")
    .input(paymentListSchema)
    .query(({ ctx, input }) => listBatches(ctx.db, ctx.userId, input)),

  deleteBatch: planProcedure("payments")
    .input(paymentBatchSchema)
    .mutation(({ ctx, input }) => deleteBatch(ctx.db, ctx.userId, input.batchId)),

  updateBatch: planProcedure("payments")
    .input(paymentUpdateBatchSchema)
    .mutation(({ ctx, input }) => updateBatch(ctx.db, ctx.userId, input)),
})
