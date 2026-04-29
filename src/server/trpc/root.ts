import { createTRPCRouter } from "@/server/trpc"
import { healthRouter } from "@/server/trpc/routers/health"
import { authRouter } from "@/server/trpc/routers/auth"

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
})

export type AppRouter = typeof appRouter
