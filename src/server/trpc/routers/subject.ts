import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  subjectCreateSchema,
  subjectFilterSchema,
  subjectUpdateSchema,
} from "@/lib/schemas/subject"
import {
  createSubject,
  listSubjects,
  softDeleteSubject,
  updateSubject,
} from "@/server/services/subject.service"

export const subjectRouter = createTRPCRouter({
  list: protectedProcedure
    .input(subjectFilterSchema.optional())
    .query(({ ctx, input }) => listSubjects(ctx.db, ctx.userId, input ?? {})),

  create: protectedProcedure
    .input(subjectCreateSchema)
    .mutation(({ ctx, input }) => createSubject(ctx.db, ctx.userId, input)),

  update: protectedProcedure
    .input(subjectUpdateSchema)
    .mutation(({ ctx, input }) =>
      updateSubject(ctx.db, ctx.userId, input.id, input.data)
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      softDeleteSubject(ctx.db, ctx.userId, input.id)
    ),
})
