import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  addRecurringStudentsSchema,
  sessionBulkCreateSchema,
  sessionBulkDeleteFutureSchema,
  sessionBulkUpdateFutureSchema,
  sessionCreateMakeupSchema,
  sessionCreateSchema,
  sessionDuplicateSchema,
  sessionFilterSchema,
  sessionUpdateSchema,
} from "@/lib/schemas/session"
import {
  addStudentsToSession,
  addStudentsToRecurringSessions,
  bulkCreateSessions,
  checkBulkCreateConflicts,
  bulkDeleteFutureSessions,
  bulkUpdateFutureSessions,
  createMakeupSession,
  createSession,
  deleteSession,
  restoreSession,
  duplicateSession,
  getMonthSessions,
  getSessionDetail,
  removeStudentFromSession,
  updateSession,
} from "@/server/services/session.service"

export const sessionRouter = createTRPCRouter({
  getMonth: protectedProcedure
    .input(sessionFilterSchema)
    .query(({ ctx, input }) => getMonthSessions(ctx.db, ctx.userId, input)),

  getDetail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => getSessionDetail(ctx.db, ctx.userId, input.id)),

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

  deleteFuture: protectedProcedure
    .input(sessionBulkDeleteFutureSchema)
    .mutation(({ ctx, input }) =>
      bulkDeleteFutureSessions(ctx.db, ctx.userId, input.id)
    ),

  updateFuture: protectedProcedure
    .input(sessionBulkUpdateFutureSchema)
    .mutation(({ ctx, input }) =>
      bulkUpdateFutureSessions(ctx.db, ctx.userId, input.id, input.data)
    ),

  duplicate: protectedProcedure
    .input(sessionDuplicateSchema)
    .mutation(({ ctx, input }) =>
      duplicateSession(ctx.db, ctx.userId, input.id, input.targetDate)
    ),

  createMakeup: protectedProcedure
    .input(sessionCreateMakeupSchema)
    .mutation(({ ctx, input }) =>
      createMakeupSession(ctx.db, ctx.userId, input.id, input)
    ),

  restore: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => restoreSession(ctx.db, ctx.userId, input.id)),

  bulkCreate: protectedProcedure
    .input(sessionBulkCreateSchema)
    .mutation(({ ctx, input }) =>
      bulkCreateSessions(ctx.db, ctx.userId, input)
    ),

  checkBulkConflicts: protectedProcedure
    .input(sessionBulkCreateSchema)
    .mutation(({ ctx, input }) =>
      checkBulkCreateConflicts(ctx.db, ctx.userId, input)
    ),

  addStudents: protectedProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        studentIds: z.array(z.number().int().positive()),
      })
    )
    .mutation(({ ctx, input }) =>
      addStudentsToSession(ctx.db, ctx.userId, input.sessionId, input.studentIds)
    ),

  removeStudent: protectedProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        studentId: z.number().int().positive(),
      })
    )
    .mutation(({ ctx, input }) =>
      removeStudentFromSession(ctx.db, ctx.userId, input.sessionId, input.studentId)
    ),

  addRecurringStudents: protectedProcedure
    .input(addRecurringStudentsSchema)
    .mutation(({ ctx, input }) =>
      addStudentsToRecurringSessions(ctx.db, ctx.userId, input)
    ),
})
