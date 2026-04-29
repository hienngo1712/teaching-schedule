import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import { formatTime, parseTimeToDate } from "@/lib/utils"

/**
 * Kiểm tra ca dạy mới có trùng giờ với ca khác trong cùng ngày, cùng user.
 * Dùng raw SQL: start_a < end_b AND end_a > start_b (chuẩn interval overlap).
 * Throw CONFLICT nếu trùng.
 */
export async function checkOverlap(
  db: PrismaClient,
  params: {
    userId: number
    sessionDate: Date
    startTime: Date
    endTime: Date
    excludeId?: number
  }
): Promise<void> {
  const { userId, sessionDate, startTime, endTime, excludeId } = params

  const conflicts = await db.$queryRaw<
    Array<{
      id: number
      title: string | null
      start_time: Date
      end_time: Date
    }>
  >(Prisma.sql`
    SELECT id, title, start_time, end_time
    FROM teaching_sessions
    WHERE user_id      = ${userId}
      AND session_date = ${sessionDate}::date
      AND id          != ${excludeId ?? 0}
      AND start_time   < ${endTime}::time
      AND end_time     > ${startTime}::time
    LIMIT 1
  `)

  if (conflicts.length > 0) {
    const c = conflicts[0]
    const label = c.title
      ? `"${c.title}"`
      : `ca ${formatTime(c.start_time)}–${formatTime(c.end_time)}`
    throw new TRPCError({
      code: "CONFLICT",
      message: `Trùng giờ với ${label} đã có trong ngày này`,
    })
  }
}

/**
 * Helper: parse "YYYY-MM-DD" → Date (UTC midnight) để khớp Prisma @db.Date.
 */
export function parseSessionDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export { parseTimeToDate }
