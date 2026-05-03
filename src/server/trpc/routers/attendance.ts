import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { attendanceUpdateSchema } from "@/lib/schemas/attendance"
import { getAttendance, updateAttendance } from "@/server/services/attendance.service"

export const attendanceRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(({ ctx, input }) => getAttendance(ctx.db, ctx.userId, input.sessionId)),

  update: protectedProcedure
    .input(attendanceUpdateSchema)
    .mutation(({ ctx, input }) => updateAttendance(ctx.db, ctx.userId, input)),
})
