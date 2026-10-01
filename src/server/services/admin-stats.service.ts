import type { PrismaClient } from "@prisma/client"
import { adminUsernames } from "@/lib/admin"
import { buildAccountTrend, computeAccountCards, lastNDays, type AccountCards, type AccountTrend, type DayCount, type TrendRange } from "@/lib/admin-stats"
import { getPendingCount } from "./plan-admin.service" // vị trí thật của getPendingCount theo P

export type AdminStats = AccountCards & { active7d: number; pendingOrders: number; newAccounts: number; updatedAt: Date }

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
// Mốc 00:00 giờ VN của ngày "YYYY-MM-DD", dạng chuỗi để ::timestamp không phụ thuộc TimeZone phiên Postgres.
const vnDayStartIso = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - VN_OFFSET_MS).toISOString()

export async function getAdminStats(db: PrismaClient, now = new Date()): Promise<AdminStats> {
  const admins = adminUsernames()
  const start7 = lastNDays(now, 7)[0]
  const [users, active7, pending] = await Promise.all([
    db.user.findMany({
      where: { isDeleted: false },
      select: { username: true, isActive: true, plan: true, planExpiresAt: true, trialEndsAt: true, lastActiveAt: true },
    }),
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT a.user_id)::int AS count
      FROM user_activity_days a JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${start7}::date AND u.is_deleted = false AND u.is_active = true AND NOT (u.username = ANY(${admins}::text[]))`,
    // Cùng hàm với badge số đơn chờ ở sidebar/tab bar (spec K A9); đã gồm số tài khoản mới.
    getPendingCount(db),
  ])
  const cards = computeAccountCards(users.filter((u) => !admins.includes(u.username)), now)
  return { ...cards, active7d: active7[0]?.count ?? 0, pendingOrders: pending.count, newAccounts: pending.newAccounts, updatedAt: now }
}

export async function getAccountTrend(db: PrismaClient, days: TrendRange, now = new Date()): Promise<AccountTrend> {
  const admins = adminUsernames()
  const list = lastNDays(now, days)
  const [newRows, returningRows, since] = await Promise.all([
    db.$queryRaw<DayCount[]>`
      SELECT to_char((u.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM users u
      WHERE u.created_at >= ${vnDayStartIso(list[0])}::timestamp AND u.is_deleted = false AND NOT (u.username = ANY(${admins}::text[]))
      GROUP BY 1`,
    // Ngày đăng ký tính là "mới", không tính "quay lại" (spec K T3).
    db.$queryRaw<DayCount[]>`
      SELECT to_char(a.day, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM user_activity_days a JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${list[0]}::date
        AND u.is_deleted = false
        AND NOT (u.username = ANY(${admins}::text[]))
        AND a.day <> ((u.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      GROUP BY 1`,
    db.$queryRaw<{ since: string | null }[]>`SELECT to_char(MIN(day), 'YYYY-MM-DD') AS since FROM user_activity_days`,
  ])
  return buildAccountTrend(list, newRows, returningRows, since[0]?.since ?? null)
}
