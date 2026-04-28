import { initTRPC, TRPCError } from "@trpc/server"
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { ZodError } from "zod"
import { db } from "@/server/db"

// Placeholder Session type — replaced bằng next-auth Session ở Phase 2.
type Session = {
  user: { id: string; name?: string | null; email?: string | null }
  expires: string
}

export type Context = {
  db: typeof db
  session: Session | null
  userId: number | null
  ip: string | null
}

export async function createTRPCContext(
  opts: FetchCreateContextFnOptions
): Promise<Context> {
  // Phase 2 sẽ resolve session từ NextAuth. Hiện tại = null.
  const session: Session | null = null
  const userId = session ? Number((session as Session).user.id) : null

  // Lấy IP từ headers (Vercel: x-forwarded-for, fallback x-real-ip)
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
