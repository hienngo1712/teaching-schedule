import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { compareVersions, isKnownRelease } from "@/lib/releases"

export async function getReleaseStatus(db: PrismaClient, userId: number) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { lastSeenRelease: true } })
  return { lastSeenRelease: u.lastSeenRelease }
}

// Tab cũ chưa tải lại sau deploy có thể gửi bản cũ hơn → không lùi.
export async function markReleaseSeen(db: PrismaClient, userId: number, version: string) {
  if (!isKnownRelease(version)) throw new TRPCError({ code: "BAD_REQUEST", message: "Phiên bản không hợp lệ" })
  const { lastSeenRelease } = await getReleaseStatus(db, userId)
  if (lastSeenRelease && compareVersions(version, lastSeenRelease) <= 0) return { lastSeenRelease }
  await db.user.update({ where: { id: userId }, data: { lastSeenRelease: version } })
  return { lastSeenRelease: version }
}
