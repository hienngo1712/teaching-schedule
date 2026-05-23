import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  studentCreateSchema,
  studentFilterSchema,
  studentUpdateSchema,
} from "@/lib/schemas/student"
import {
  createStudent,
  listStudents,
  softDeleteStudent,
  updateStudent,
  upgradeAllClasses,
  getUpgradeLogThisYear,
} from "@/server/services/student.service"

export const studentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(studentFilterSchema)
    .query(({ ctx, input }) => listStudents(ctx.db, ctx.userId, input)),

  create: protectedProcedure
    .input(studentCreateSchema)
    .mutation(({ ctx, input }) => createStudent(ctx.db, ctx.userId, input)),

  update: protectedProcedure
    .input(studentUpdateSchema)
    .mutation(({ ctx, input }) =>
      updateStudent(ctx.db, ctx.userId, input.id, input.data)
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      softDeleteStudent(ctx.db, ctx.userId, input.id)
    ),

  upgradeAllClasses: protectedProcedure
    .mutation(({ ctx }) => upgradeAllClasses(ctx.db, ctx.userId, "manual")),

  getUpgradeLogThisYear: protectedProcedure
    .query(({ ctx }) => getUpgradeLogThisYear(ctx.db, ctx.userId)),
})
