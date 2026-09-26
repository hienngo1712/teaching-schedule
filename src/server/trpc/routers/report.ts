import { z } from "zod"
import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
import { isMultiMonthReport } from "@/lib/plans"
import { assertFeature } from "@/server/services/plan.service"
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
    .query(async ({ ctx, input }) => {
      // D10: đúng 1 tháng, không lọc lớp là Plus; nhiều tháng hoặc có lớp là Pro.
      await assertFeature(ctx.db, ctx.userId, isMultiMonthReport(input) ? "multiMonthReport" : "monthlyReport")
      return getStudentReport(ctx.db, ctx.userId, input)
    }),

  monthlySummary: protectedProcedure
    .input(z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      toYear: z.number().int().optional(),
      toMonth: z.number().int().min(1).max(12).optional(),
      grade: z.number().int().min(1).max(12).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertFeature(ctx.db, ctx.userId, isMultiMonthReport(input) ? "multiMonthReport" : "monthlyReport")
      return getMonthlySummary(ctx.db, ctx.userId, input)
    }),

  dashboard: protectedProcedure
    .query(({ ctx }) => getDashboardStats(ctx.db, ctx.userId)),

  alerts: planProcedure("dashboardAlerts")
    .query(({ ctx }) => getDashboardAlerts(ctx.db, ctx.userId)),
})
