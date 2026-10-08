import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import pkg from "../../../package.json"

export const FEEDBACK_DAILY_LIMIT = 5
export const FEEDBACK_PROMPT_MIN_DAYS = 7
export const FEEDBACK_PAGE_SIZE = 50
export const FEEDBACK_MESSAGE_MAX = 1000

// Khoá 2 số theo user (7401, 7402 đã dùng): 2 lần gửi cùng lúc phải chờ nhau, không cùng đọc "còn lượt".
const FEEDBACK_LOCK_NS = 7403

export async function submitFeedback(
  db: PrismaClient,
  userId: number,
  input: { rating: number; message?: string; page: string }
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FEEDBACK_LOCK_NS}::int, ${userId}::int)`
    const since = new Date(Date.now() - 24 * 3600_000)
    const recent = await tx.feedback.count({ where: { userId, createdAt: { gte: since } } })
    if (recent >= FEEDBACK_DAILY_LIMIT) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "FEEDBACK_LIMIT" })
    // Bản app lấy ở server, không tin client.
    await tx.feedback.create({
      data: { userId, rating: input.rating, message: input.message?.trim() || null, page: input.page, appVersion: pkg.version },
    })
    await tx.user.updateMany({ where: { id: userId, feedbackPromptAt: null }, data: { feedbackPromptAt: new Date() } })
    return { ok: true as const }
  })
}

export async function getFeedbackPromptStatus(db: PrismaClient, userId: number) {
  const [user, sent, days] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { feedbackPromptAt: true } }),
    db.feedback.count({ where: { userId } }),
    db.userActivityDay.count({ where: { userId } }),
  ])
  return { shouldPrompt: user.feedbackPromptAt === null && sent === 0 && days >= FEEDBACK_PROMPT_MIN_DAYS }
}

export async function dismissFeedbackPrompt(db: PrismaClient, userId: number) {
  await db.user.updateMany({ where: { id: userId, feedbackPromptAt: null }, data: { feedbackPromptAt: new Date() } })
  return { ok: true as const }
}

export async function listFeedback(db: PrismaClient, cursor?: number) {
  const [rows, total, groups] = await Promise.all([
    db.feedback.findMany({
      where: cursor ? { id: { lt: cursor } } : undefined,
      orderBy: { id: "desc" },
      take: FEEDBACK_PAGE_SIZE + 1,
      select: {
        id: true, rating: true, message: true, page: true, appVersion: true, createdAt: true,
        user: { select: { username: true, fullName: true } },
      },
    }),
    db.feedback.count(),
    db.feedback.groupBy({ by: ["rating"], _count: { _all: true } }),
  ])
  const page = rows.slice(0, FEEDBACK_PAGE_SIZE)
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  let sum = 0
  for (const g of groups) {
    counts[g.rating as 1 | 2 | 3 | 4 | 5] = g._count._all
    sum += g.rating * g._count._all
  }
  return {
    items: page.map(({ user, ...f }) => ({ ...f, username: user.username, fullName: user.fullName })),
    nextCursor: rows.length > FEEDBACK_PAGE_SIZE ? page[page.length - 1].id : null,
    total,
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
    counts,
  }
}
