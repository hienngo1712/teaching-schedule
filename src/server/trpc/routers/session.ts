import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  sessionBulkCreateSchema,
  sessionCreateSchema,
  sessionFilterSchema,
  sessionUpdateSchema,
} from "@/lib/schemas/session"
import {
  bulkCreateSessions,
  createSession,
  deleteSession,
  getMonthSessions,
  updateSession,
} from "@/server/services/session.service"

export const sessionRouter = createTRPCRouter({
  getMonth: protectedProcedure
    .input(sessionFilterSchema)
    .query(({ ctx, input }) => getMonthSessions(ctx.db, ctx.userId, input)),

  create: protectedProcedure
    .input(sessionCreateSchema)
    .mutation(({ ctx, input }) => createSession(ctx.db, ctx.userId, input)),

  update: protectedProcedure
    .input(sessionUpdateSchema)
    .mutation(({ ctx, input }) =>
      updateSession(ctx.db, ctx.userId, input.id, input.data)
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      deleteSession(ctx.db, ctx.userId, input.id)
    ),

  bulkCreate: protectedProcedure
    .input(sessionBulkCreateSchema)
    .mutation(({ ctx, input }) =>
      bulkCreateSessions(ctx.db, ctx.userId, input)
    ),
})
