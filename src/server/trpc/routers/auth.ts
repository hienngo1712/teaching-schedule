import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc"
import { registerInputSchema } from "@/lib/schemas/auth"
import {
  isRegisterRateLimited,
  recordRegisterAttempt,
} from "@/server/auth-credentials"
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
    .input(registerInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Throttle theo IP để chặn spam tạo tài khoản (procedure công khai).
      if (await isRegisterRateLimited(ctx.ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Quá nhiều lần đăng ký từ địa chỉ này, vui lòng thử lại sau",
        })
      }
      try {
        const user = await registerUser(ctx.db, input, { ipAddress: ctx.ip })
        await recordRegisterAttempt(ctx.ip, true)
        return user
      } catch (err) {
        await recordRegisterAttempt(ctx.ip, false)
        throw err
      }
    }),
})
