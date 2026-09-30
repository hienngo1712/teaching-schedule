import { z } from "zod"
import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
import {
  studentCreateInputSchema,
  studentFilterSchema,
  studentImportCheckSchema,
  studentImportSchema,
  studentUpdateSchema,
} from "@/lib/schemas/student"
import { recordConsent, assertUpdateConsent } from "@/server/services/consent.service"
import { logSecurityEvent } from "@/server/services/security-event.service"
import { updateTouchesPersonalData } from "@/lib/consent"
import {
  checkImportDuplicates,
  createStudent,
  deactivateStudent,
  importStudents,
  listStudents,
  softDeleteStudent,
  getStudentDeleteCheck,
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
    .input(studentCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await recordConsent(ctx.db, { userId: ctx.userId, scope: "student", ipAddress: ctx.ip })
      return createStudent(ctx.db, ctx.userId, input)
    }),

  update: protectedProcedure
    .input(studentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      assertUpdateConsent(input.data, input.consent)
      if (updateTouchesPersonalData(input.data)) {
        await recordConsent(ctx.db, { userId: ctx.userId, scope: "student", studentId: input.id, ipAddress: ctx.ip })
      }
      return updateStudent(ctx.db, ctx.userId, input.id, input.data)
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      deactivateStudent(ctx.db, ctx.userId, input.id)
    ),

  deleteCheck: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => getStudentDeleteCheck(ctx.db, ctx.userId, input.id)),

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
    .mutation(async ({ ctx, input }) => {
      await recordConsent(ctx.db, { userId: ctx.userId, scope: "student_import", itemCount: input.rows.length, ipAddress: ctx.ip })
      return importStudents(ctx.db, ctx.userId, input.rows)
    }),

  generateParentLink: planProcedure("parentLink")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const res = await generateParentLink(ctx.db, ctx.userId, input.id)
      await logSecurityEvent(ctx.db, { userId: ctx.userId, event: "parent_link_create", ipAddress: ctx.ip })
      return res
    }),

  disableParentLink: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const res = await disableParentLink(ctx.db, ctx.userId, input.id)
      await logSecurityEvent(ctx.db, { userId: ctx.userId, event: "parent_link_disable", ipAddress: ctx.ip })
      return res
    }),
})
