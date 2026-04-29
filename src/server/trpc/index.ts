import { initTRPC, TRPCError } from "@trpc/server"
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { ZodError } from "zod"
import type { Session } from "next-auth"
import { db } from "@/server/db"

export type Context = {
  db: typeof db
  session: Session | null
  userId: number | null
  ip: string | null
}

export async function createTRPCContext(
  opts: FetchCreateContextFnOptions
): Promise<Context> {
  // Lazy-load NextAuth để tránh kéo `next-auth` (next/server) vào unit/integration test runtime.
  const { auth } = await import("@/server/auth")
  const session = await auth()
  const userId = session?.user?.id ? Number(session.user.id) : null

  const fwd = opts.req.headers.get("x-forwarded-for")
  const ip = fwd?.split(",")[0]?.trim() ?? opts.req.headers.get("x-real-ip")

  return { db, session, userId, ip }
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.userId,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
