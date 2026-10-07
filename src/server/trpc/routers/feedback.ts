import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { isAdminUsername } from "@/lib/admin"
import {
  FEEDBACK_MESSAGE_MAX,
  dismissFeedbackPrompt,
  getFeedbackPromptStatus,
  submitFeedback,
} from "@/server/services/feedback.service"

// Góp ý chỉ dành cho giáo viên; admin không dùng app như giáo viên.
const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (isAdminUsername(ctx.session.user.username)) throw new TRPCError({ code: "FORBIDDEN" })
  return next()
})

export const feedbackRouter = createTRPCRouter({
  submit: teacherProcedure
    .input(
      z.object({
        rating: z.number().int().min(1).max(5),
        message: z.string().max(FEEDBACK_MESSAGE_MAX).optional(),
        page: z.string().min(1).max(100),
      })
    )
    .mutation(({ ctx, input }) => submitFeedback(ctx.db, ctx.userId, input)),
  promptStatus: teacherProcedure.query(({ ctx }) => getFeedbackPromptStatus(ctx.db, ctx.userId)),
  dismissPrompt: teacherProcedure.mutation(({ ctx }) => dismissFeedbackPrompt(ctx.db, ctx.userId)),
})
