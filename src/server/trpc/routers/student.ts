import { z } from "zod"
import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
import {
  studentCreateSchema,
  studentFilterSchema,
  studentImportCheckSchema,
  studentImportSchema,
  studentUpdateSchema,
} from "@/lib/schemas/student"
import {
  checkImportDuplicates,
  createStudent,
  importStudents,
  listStudents,
  softDeleteStudent,
  updateStudent,
  upgradeAllClasses,
  getUpgradeLogThisYear,
} from "@/server/services/student.service"
import {
  disableParentLink,
  generateParentLink,
} from "@/server/services/parent-link.service"

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

  // mutation để 500 dòng đi trong body POST, không nhét vào URL GET
  importCheck: planProcedure("studentImport")
    .input(studentImportCheckSchema)
    .mutation(({ ctx, input }) => checkImportDuplicates(ctx.db, ctx.userId, input.rows)),

  importMany: planProcedure("studentImport")
    .input(studentImportSchema)
    .mutation(({ ctx, input }) => importStudents(ctx.db, ctx.userId, input.rows)),

  generateParentLink: planProcedure("parentLink")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => generateParentLink(ctx.db, ctx.userId, input.id)),

  disableParentLink: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => disableParentLink(ctx.db, ctx.userId, input.id)),
})
