// Helper tạo tRPC caller cho integration tests.
// publicCaller dùng được ngay (Sub 1.5+); getAuthedCaller cần NextAuth (Phase 2+).
import { appRouter } from "@/server/trpc/root"
import { createCallerFactory } from "@/server/trpc"
import { db } from "@/server/db"

const createCaller = createCallerFactory(appRouter)

export const publicCaller = createCaller({
  db,
  session: null,
  userId: null,
  ip: null,
})

// TODO Phase 2: thêm getAuthedCaller(username) sau khi có NextAuth Session type
