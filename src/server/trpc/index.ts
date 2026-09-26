import { initTRPC, TRPCError } from "@trpc/server"
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { ZodError } from "zod"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import type { Feature } from "@/lib/plans"
import { PlanRequiredError, assertFeature } from "@/server/services/plan.service"

export type Context = {
  db: typeof db
  session: Session | null
  userId: number | null
  ip: string | null
}

export async function createTRPCContext(
  opts: FetchCreateContextFnOptions
): Promise<Context> {
  const start = Date.now()
  // Lazy-load NextAuth để tránh kéo `next-auth` (next/server) vào unit/integration test runtime.
  const { auth } = await import("@/server/auth")
  const session = await auth()
  const duration = Date.now() - start
  if (duration > 100) {
    console.log(`[tRPC] createTRPCContext took ${duration}ms`)
  }

  const userId = session?.user?.id ? Number(session.user.id) : null

  // #3: x-forwarded-for client gửi được → spoofable. Phải deploy SAU reverse
  // proxy tin cậy (Vercel/nginx) ghi đè header này; chuẩn hóa IP là việc của
  // tầng hạ tầng, không nên tự xử lý trong app (dễ cấu hình sai, phản tác dụng).
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
        planRequired: error.cause instanceof PlanRequiredError ? error.cause.plan : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start
  if (durationMs > 100) { // Cùng ngưỡng với các log khác, tránh 1 dòng/request
    console.log(`[tRPC] ${type} ${path} - ${durationMs}ms`)
  }
  return result
})

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

export const protectedProcedure = t.procedure.use(loggerMiddleware).use(enforceAuth)

// Chặn theo gói ở server (spec I mục 6.3): tốn thêm 1 query đọc user, chỉ ở procedure cần gói.
export const planProcedure = (feature: Feature) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    await assertFeature(ctx.db, ctx.userId, feature)
    return next()
  })
