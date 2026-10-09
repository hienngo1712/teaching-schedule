import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { payosConnectSchema } from "@/lib/schemas/payos"
import { connectTeacherPayos, disconnectTeacherPayos, getTeacherPayosStatus } from "@/server/services/payos-teacher.service"

export const payosRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => getTeacherPayosStatus(ctx.db, ctx.userId)),
  connect: protectedProcedure.input(payosConnectSchema).mutation(({ ctx, input }) => connectTeacherPayos(ctx.db, ctx.userId, input, ctx.origin)),
  // Không chặn theo gói: hết Pro vẫn phải ngắt được.
  disconnect: protectedProcedure.mutation(({ ctx }) => disconnectTeacherPayos(ctx.db, ctx.userId)),
})
