import { createTRPCRouter } from "@/server/trpc"
import { healthRouter } from "@/server/trpc/routers/health"
import { authRouter } from "@/server/trpc/routers/auth"
import { studentRouter } from "@/server/trpc/routers/student"
import { subjectRouter } from "@/server/trpc/routers/subject"
import { sessionRouter } from "@/server/trpc/routers/session"
import { attendanceRouter } from "@/server/trpc/routers/attendance"

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  subject: subjectRouter,
  student: studentRouter,
  session: sessionRouter,
  attendance: attendanceRouter,
})

export type AppRouter = typeof appRouter
