import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { getReleaseStatus, markReleaseSeen } from "@/server/services/release.service"

export const releaseRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => getReleaseStatus(ctx.db, ctx.userId)),
  markSeen: protectedProcedure
    .input(z.object({ version: z.string().min(1).max(20) }))
    .mutation(({ ctx, input }) => markReleaseSeen(ctx.db, ctx.userId, input.version)),
})
