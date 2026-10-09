import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { listPayosNotices, markPayosNoticesSeen } from "@/server/services/payos-notice.service"

export const payosNoticeRouter = createTRPCRouter({
  // Không chặn theo gói: hết Pro vẫn xem lịch sử tiền đã vào (spec AI §4).
  list: protectedProcedure.query(({ ctx }) => listPayosNotices(ctx.db, ctx.userId)),
  markSeen: protectedProcedure
    .input(z.object({ upTo: z.string().datetime() }))
    .mutation(({ ctx, input }) => markPayosNoticesSeen(ctx.db, ctx.userId, new Date(input.upTo))),
})
