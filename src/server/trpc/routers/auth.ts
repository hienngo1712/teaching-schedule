import { TRPCError } from "@trpc/server"
import bcrypt from "bcryptjs"
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc"
import { changePasswordSchema, registerSchema } from "@/lib/schemas/auth"
import { BCRYPT_COST } from "@/server/auth-credentials"
import { registerUser } from "@/server/services/user.service"

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, username: true, fullName: true },
    })
    return user
  }),

  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      return registerUser(ctx.db, input)
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.userId },
      })

      const ok = await bcrypt.compare(input.currentPassword, user.passwordHash)
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mật khẩu hiện tại không đúng",
        })
      }

      const newHash = await bcrypt.hash(input.newPassword, BCRYPT_COST)
      await ctx.db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      })

      return { success: true as const }
    }),
})
