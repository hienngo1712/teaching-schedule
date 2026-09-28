import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { trashListSchema, trashPurgeSchema, trashRestoreSchema } from "@/lib/schemas/trash"
import { getTrashCounts, listTrash, restoreTrashItem } from "@/server/services/trash.service"
import { purgeAllTrash, purgeTrash } from "@/server/services/trash-purge.service"

// Mọi gói đều dùng được (spec Q Q12, R4).
export const trashRouter = createTRPCRouter({
  counts: protectedProcedure.query(({ ctx }) => getTrashCounts(ctx.db, ctx.userId)),
  list: protectedProcedure.input(trashListSchema).query(({ ctx, input }) => listTrash(ctx.db, ctx.userId, input)),
  restore: protectedProcedure.input(trashRestoreSchema).mutation(({ ctx, input }) => restoreTrashItem(ctx.db, ctx.userId, input)),
  purge: protectedProcedure.input(trashPurgeSchema).mutation(async ({ ctx, input }) => {
    const purged = { session: 0, student: 0, payment: 0, subject: 0 }
    purged[input.type] = await purgeTrash(ctx.db, ctx.userId, input.type)
    return { purged }
  }),
  purgeAll: protectedProcedure.mutation(({ ctx }) => purgeAllTrash(ctx.db, ctx.userId)),
})
