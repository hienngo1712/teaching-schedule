import { createTRPCRouter } from "@/server/trpc"
import { healthRouter } from "@/server/trpc/routers/health"
import { authRouter } from "@/server/trpc/routers/auth"
import { studentRouter } from "@/server/trpc/routers/student"

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  student: studentRouter,
})

export type AppRouter = typeof appRouter
