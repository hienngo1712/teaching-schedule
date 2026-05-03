// Logic verify credentials + rate limit + audit log.
// Tách khỏi `auth.ts` để tests có thể import mà không cần next-auth runtime.
import bcrypt from "bcryptjs"
import { db } from "@/server/db"

// Cost 10: chuẩn OWASP, hash ~50ms với native bcrypt — đủ mạnh cho app nội bộ.
// Cost 4 trong test: tốc độ tối đa.
export const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 10
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_FAILS = 5

export class RateLimitedError extends Error {
  constructor() {
    super("RATE_LIMITED")
    this.name = "RateLimitedError"
  }
}

export async function isRateLimited(username: string): Promise<boolean> {
  const recentFails = await db.loginAttempt.count({
    where: {
      username,
      success: false,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  })
  return recentFails >= RATE_LIMIT_MAX_FAILS
}

export type AuthorizedUser = {
  id: string
  username: string
  fullName: string | null
}

/**
 * Verify credentials với rate limit + LoginAttempt audit + lastLoginAt update.
 * Throw `RateLimitedError` nếu vượt giới hạn. Trả `null` nếu sai username/password.
 */
export async function authorizeCredentials(
  username: string,
  password: string,
  ipAddress: string | null
): Promise<AuthorizedUser | null> {
  if (await isRateLimited(username)) {
    throw new RateLimitedError()
  }

  const user = await db.user.findUnique({ where: { username } })

  if (!user || !user.isActive) {
    await db.loginAttempt.create({
      data: { username, ipAddress, success: false, userId: user?.id ?? null },
    })
    return null
  }

  const ok = await bcrypt.compare(password, user.passwordHash)

  if (!ok) {
    await db.loginAttempt.create({
      data: { username, ipAddress, success: false, userId: user.id },
    })
    return null
  }

  // Login OK: chạy 2 write song song thay vì tuần tự
  await Promise.all([
    db.loginAttempt.create({
      data: { username, ipAddress, success: true, userId: user.id },
    }),
    db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ])

  return {
    id: String(user.id),
    username: user.username,
    fullName: user.fullName,
  }
}
