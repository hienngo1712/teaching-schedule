// Helper tạo tRPC caller cho integration tests.
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

export async function getAuthedCaller(username = "teacher") {
  const user = await db.user.findUniqueOrThrow({ where: { username } })
  return createCaller({
    db,
    session: {
      user: {
        id: String(user.id),
        username: user.username,
        fullName: user.fullName,
        name: user.fullName,
        email: null,
      },
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
    userId: user.id,
    ip: null,
  })
}
