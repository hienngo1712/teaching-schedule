import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  sessionBulkCreateSchema,
  sessionCreateSchema,
  sessionFilterSchema,
  sessionUpdateSchema,
} from "@/lib/schemas/session"
import {
  addStudentsToSession,
  bulkCreateSessions,
  createSession,
  deleteSession,
  getMonthSessions,
  removeStudentFromSession,
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
    .input(
      z.object({
        studentIds: z.array(z.number().int().positive()),
        startTime: z.string(),
        endTime: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        weekdays: z.array(z.number().min(0).max(6)),
      })
    )
    .mutation(({ ctx, input }) =>
      addStudentsToRecurringSessions(ctx.db, ctx.userId, input)
    ),
})
