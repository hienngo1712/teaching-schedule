import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { compareVersions, isKnownRelease } from "@/lib/releases"

export async function getReleaseStatus(db: PrismaClient, userId: number) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { lastSeenRelease: true } })
  return { lastSeenRelease: u.lastSeenRelease }
}

// Tab cũ chưa tải lại sau deploy có thể gửi bản cũ hơn → không lùi.
export async function markReleaseSeen(db: PrismaClient, userId: number, version: string): Promise<{ lastSeenRelease: string | null }> {
  if (!isKnownRelease(version)) throw new TRPCError({ code: "BAD_REQUEST", message: "Phiên bản không hợp lệ" })
  const { lastSeenRelease } = await getReleaseStatus(db, userId)
  if (lastSeenRelease && compareVersions(version, lastSeenRelease) <= 0) return { lastSeenRelease }
  // Ghi có điều kiện: tab khác ghi xen giữa thì đọc lại rồi so tiếp, không đè.
  const { count } = await db.user.updateMany({ where: { id: userId, lastSeenRelease }, data: { lastSeenRelease: version } })
  if (count === 0) return markReleaseSeen(db, userId, version)
  return { lastSeenRelease: version }
}
