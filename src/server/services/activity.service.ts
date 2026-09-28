import type { PrismaClient } from "@prisma/client"
import { isAdminUsername } from "@/lib/admin"
import { shouldTouch, vnDayDate } from "@/lib/activity"

// Gọi mỗi request đã đăng nhập (nodeJwt): phần lớn request return ngay, không tốn truy vấn (spec K B1–B4).
export async function touchActivity(
  db: PrismaClient,
  u: { id: number; username: string; lastActiveAt: Date | null },
  now: Date
): Promise<void> {
  if (isAdminUsername(u.username) || !shouldTouch(u.lastActiveAt, now)) return
  try {
    await db.$transaction([
      db.userActivityDay.createMany({ data: [{ userId: u.id, day: vnDayDate(now), firstSeenAt: now }], skipDuplicates: true }),
      // Raw để không bump updated_at; ::timestamp để không phụ thuộc TimeZone của phiên Postgres.
      db.$executeRaw`UPDATE "users" SET "last_active_at" = ${now.toISOString()}::timestamp WHERE "id" = ${u.id}`,
    ])
  } catch (e) {
    console.warn(`[activity] không ghi được hoạt động user ${u.id}`, e)
  }
}
