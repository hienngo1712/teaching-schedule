import { createTRPCRouter } from "@/server/trpc"
import { healthRouter } from "@/server/trpc/routers/health"
import { authRouter } from "@/server/trpc/routers/auth"
import { studentRouter } from "@/server/trpc/routers/student"
import { subjectRouter } from "@/server/trpc/routers/subject"
import { sessionRouter } from "@/server/trpc/routers/session"
import { attendanceRouter } from "@/server/trpc/routers/attendance"
import { reportRouter } from "@/server/trpc/routers/report"
import { tuitionRouter } from "@/server/trpc/routers/tuition"
import { paymentRouter } from "@/server/trpc/routers/payment"
import { settingsRouter } from "@/server/trpc/routers/settings"

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  subject: subjectRouter,
  student: studentRouter,
  session: sessionRouter,
  attendance: attendanceRouter,
  report: reportRouter,
  tuition: tuitionRouter,
  payment: paymentRouter,
  settings: settingsRouter,
})

export type AppRouter = typeof appRouter
