import { z } from "zod"
import { createTRPCRouter, planProcedure, protectedProcedure } from "@/server/trpc"
import { incomeDetailSchema } from "@/lib/schemas/timesheet"
import {
  disablePlaceShareLink,
  ensurePlaceShareLink,
  getPlaceNotice,
  markPlaceNoticeSent,
  rotatePlaceShareLink,
  toNoticeCard,
} from "@/server/services/place-notice.service"

const placeInput = z.object({ placeId: z.number().int().positive() })

// Phiếu báo theo nơi dạy (spec AN §1): gói Plus. Tắt link luôn được (kể cả khi đã hạ gói).
export const placeNoticeRouter = createTRPCRouter({
  get: planProcedure("placeNotice")
    .input(incomeDetailSchema)
    .query(async ({ ctx, input }) => {
      const n = await getPlaceNotice(ctx.db, ctx.userId, input.placeId, input.year, input.month)
      return {
        ...toNoticeCard(n),
        placeId: n.place.id,
        status: n.status,
        sentAt: n.sentAt?.toISOString() ?? null,
        sentAmount: n.sentAmount,
        amountChanged: n.amountChanged,
      }
    }),

  link: planProcedure("placeNotice").input(placeInput).mutation(({ ctx, input }) => ensurePlaceShareLink(ctx.db, ctx.userId, input.placeId)),

  rotate: planProcedure("placeNotice").input(placeInput).mutation(({ ctx, input }) => rotatePlaceShareLink(ctx.db, ctx.userId, input.placeId)),

  disable: protectedProcedure.input(placeInput).mutation(({ ctx, input }) => disablePlaceShareLink(ctx.db, ctx.userId, input.placeId)),

  markSent: planProcedure("placeNotice")
    .input(incomeDetailSchema.extend({ sent: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const r = await markPlaceNoticeSent(ctx.db, ctx.userId, input.placeId, input.year, input.month, input.sent)
      return { sentAt: r.sentAt?.toISOString() ?? null, sentAmount: r.sentAmount }
    }),
})
