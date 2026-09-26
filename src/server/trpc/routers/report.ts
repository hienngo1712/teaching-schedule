import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  getDashboardAlerts,
  getDashboardStats,
  getMonthlySummary,
  getStudentReport,
} from "@/server/services/report.service"

export const reportRouter = createTRPCRouter({
  student: protectedProcedure
    .input(z.object({
      studentId: z.number().int().positive(),
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      toYear: z.number().int().optional(),
      toMonth: z.number().int().min(1).max(12).optional(),
    }))
    .query(({ ctx, input }) => getStudentReport(ctx.db, ctx.userId, input)),

  monthlySummary: protectedProcedure
    .input(z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      toYear: z.number().int().optional(),
      toMonth: z.number().int().min(1).max(12).optional(),
      grade: z.number().int().min(1).max(9).optional(),
    }))
    .query(({ ctx, input }) => getMonthlySummary(ctx.db, ctx.userId, input)),

  dashboard: protectedProcedure
    .query(({ ctx }) => getDashboardStats(ctx.db, ctx.userId)),

  alerts: protectedProcedure
    .query(({ ctx }) => getDashboardAlerts(ctx.db, ctx.userId)),
})
