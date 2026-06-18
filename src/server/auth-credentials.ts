// Logic verify credentials + rate limit + audit log.
// Tách khỏi `auth.ts` để tests có thể import mà không cần next-auth runtime.
import bcrypt from "bcryptjs"
import { db } from "@/server/db"

// Cost 10: chuẩn OWASP, hash ~50ms với native bcrypt — đủ mạnh cho app nội bộ.
// Cost 4 trong test: tốc độ tối đa.
export const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 10
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_FAILS = 5
// Trần số lần sai TỪ MỘT IP (mọi username) — chặn brute-force/spray phân tán qua
// nhiều username từ cùng một nguồn. Đặt cao hơn ngưỡng username để không khóa
// nhầm khi nhiều giáo viên dùng chung IP (NAT).
const RATE_LIMIT_MAX_IP_FAILS = 20
// Trần số lần đăng ký từ một IP trong cửa sổ — chặn spam tạo tài khoản.
const REGISTER_RATE_LIMIT_MAX = 5
// Sentinel ghi log lần đăng ký vào loginAttempt. Chứa '@' (không hợp lệ cho
// username thật theo regex [a-zA-Z0-9_]) nên không bao giờ đụng rate-limit login.
const REGISTER_SENTINEL = "@register"

export class RateLimitedError extends Error {
  constructor() {
    super("RATE_LIMITED")
    this.name = "RateLimitedError"
  }
}

/**
 * Giới hạn đăng nhập theo HAI tầng:
 *  - Theo username: >= RATE_LIMIT_MAX_FAILS lần sai → chặn (bảo vệ 1 tài khoản).
 *  - Theo IP: >= RATE_LIMIT_MAX_IP_FAILS lần sai từ cùng IP (mọi username) → chặn
 *    (bảo vệ trước brute-force phân tán qua nhiều username). Bỏ qua khi IP null.
 */
export async function isRateLimited(username: string, ipAddress: string | null): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

  const userFails = await db.loginAttempt.count({
    where: { username, success: false, createdAt: { gte: since } },
  })
  if (userFails >= RATE_LIMIT_MAX_FAILS) return true

  if (ipAddress) {
    const ipFails = await db.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: since },
        // Loại log đăng ký để spam đăng ký không trộn vào giới hạn đăng nhập.
        username: { not: REGISTER_SENTINEL },
      },
    })
    if (ipFails >= RATE_LIMIT_MAX_IP_FAILS) return true
  }

  return false
}

/** True nếu IP đã đăng ký quá REGISTER_RATE_LIMIT_MAX lần trong cửa sổ. */
export async function isRegisterRateLimited(ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const recent = await db.loginAttempt.count({
    where: { username: REGISTER_SENTINEL, ipAddress, createdAt: { gte: since } },
  })
  return recent >= REGISTER_RATE_LIMIT_MAX
}

/** Ghi log một lần thử đăng ký (để throttle theo IP). */
export async function recordRegisterAttempt(
  ipAddress: string | null,
  success: boolean
): Promise<void> {
  await db.loginAttempt.create({
    data: { username: REGISTER_SENTINEL, ipAddress, success, userId: null },
  })
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
  if (await isRateLimited(username, ipAddress)) {
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
