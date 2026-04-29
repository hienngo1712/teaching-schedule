import { createTRPCRouter } from "@/server/trpc"
import { healthRouter } from "@/server/trpc/routers/health"
import { authRouter } from "@/server/trpc/routers/auth"
import { studentRouter } from "@/server/trpc/routers/student"
import { subjectRouter } from "@/server/trpc/routers/subject"

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  subject: subjectRouter,
  student: studentRouter,
})

export type AppRouter = typeof appRouter
