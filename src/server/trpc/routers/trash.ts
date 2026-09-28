import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { trashListSchema, trashRestoreSchema } from "@/lib/schemas/trash"
import { getTrashCounts, listTrash, restoreTrashItem } from "@/server/services/trash.service"

// Mọi gói đều dùng được (spec Q Q12).
export const trashRouter = createTRPCRouter({
  counts: protectedProcedure.query(({ ctx }) => getTrashCounts(ctx.db, ctx.userId)),
  list: protectedProcedure.input(trashListSchema).query(({ ctx, input }) => listTrash(ctx.db, ctx.userId, input)),
  restore: protectedProcedure.input(trashRestoreSchema).mutation(({ ctx, input }) => restoreTrashItem(ctx.db, ctx.userId, input)),
})
