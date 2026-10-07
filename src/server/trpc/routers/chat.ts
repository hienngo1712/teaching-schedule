import { createTRPCRouter, teacherProcedure } from "@/server/trpc"
import { chatCursorSchema, chatSendSchema } from "@/lib/schemas/chat"
import { getUserUnread, listUserMessages, markUserRead, sendUserMessage } from "@/server/services/chat.service"

export const chatRouter = createTRPCRouter({
  unread: teacherProcedure.query(({ ctx }) => getUserUnread(ctx.db, ctx.userId)),
  messages: teacherProcedure.input(chatCursorSchema).query(({ ctx, input }) => listUserMessages(ctx.db, ctx.userId, input.cursor)),
  send: teacherProcedure
    .input(chatSendSchema)
    .mutation(({ ctx, input }) => sendUserMessage(ctx.db, { id: ctx.userId, username: ctx.session.user.username }, input.body)),
  markRead: teacherProcedure.mutation(({ ctx }) => markUserRead(ctx.db, ctx.userId)),
})
