import { z } from "zod"
import { createTRPCRouter, planProcedure } from "@/server/trpc"
import { assertFeature } from "@/server/services/plan.service"
import { getAttendanceMonth, getAttendanceSchoolYear } from "@/server/services/attendance-report.service"

const filter = { placeId: z.number().int().positive().optional(), grade: z.number().int().min(1).max(12).optional() }

// Chuyên cần (spec AN §3): tháng Plus; năm học + lọc lớp Pro (như Báo cáo).
export const attendanceReportRouter = createTRPCRouter({
  month: planProcedure("attendanceMonth")
    .input(z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12), ...filter }))
    .query(async ({ ctx, input }) => {
      if (input.grade !== undefined) await assertFeature(ctx.db, ctx.userId, "attendanceYear")
      return getAttendanceMonth(ctx.db, ctx.userId, input)
    }),

  schoolYear: planProcedure("attendanceYear")
    .input(z.object({ startYear: z.number().int().min(2000).max(2100), ...filter }))
    .query(({ ctx, input }) => getAttendanceSchoolYear(ctx.db, ctx.userId, input)),
})
