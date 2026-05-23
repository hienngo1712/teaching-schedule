import { TRPCError } from "@trpc/server"
import bcrypt from "bcryptjs"
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc"
import { changePasswordSchema, registerSchema } from "@/lib/schemas/auth"
import { BCRYPT_COST } from "@/server/auth-credentials"
import { registerUser } from "@/server/services/user.service"
import { upgradeAllClasses } from "@/server/services/student.service"

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, username: true, fullName: true },
    })

    // Lazy auto-upgrade: từ tháng 7 (getMonth >= 6) trở đi, nếu user chưa có
    // log năm nay → chạy 1 lần. Lỗi auto KHÔNG được chặn login.
    const now = new Date()
    if (now.getUTCMonth() >= 6) {
      const year = now.getUTCFullYear()
      const log = await ctx.db.classUpgradeLog.findUnique({
        where: { userId_year: { userId: ctx.userId, year } },
      })
      if (!log) {
        try {
          await upgradeAllClasses(ctx.db, ctx.userId, "auto")
        } catch (err) {
          console.error("[auto-upgrade] failed:", err)
        }
      }
    }

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
