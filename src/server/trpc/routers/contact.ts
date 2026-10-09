import { adminProcedure, createTRPCRouter, publicProcedure } from "@/server/trpc"
import { contactInputSchema } from "@/lib/schemas/contact"
import { getContact, getContactHistory, updateContact } from "@/server/services/contact.service"

export const contactRouter = createTRPCRouter({
  // Công khai: trang /guide, /privacy xem được khi chưa đăng nhập.
  get: publicProcedure.query(({ ctx }) => getContact(ctx.db)),
  history: adminProcedure.query(({ ctx }) => getContactHistory(ctx.db)),
  update: adminProcedure
    .input(contactInputSchema)
    .mutation(({ ctx, input }) => updateContact(ctx.db, ctx.session.user.username, input)),
})
