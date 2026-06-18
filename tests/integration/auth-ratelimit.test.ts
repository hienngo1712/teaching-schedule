import { describe, it, expect, beforeEach } from "vitest"
import { authorizeCredentials, RateLimitedError } from "@/server/auth-credentials"
import { db } from "@/server/db"
import { appRouter } from "@/server/trpc/root"
import { createCallerFactory } from "@/server/trpc"

const createCaller = createCallerFactory(appRouter)
function callerWithIp(ip: string | null) {
  return createCaller({ db, session: null, userId: null, ip })
}

// Xóa user test + bản ghi phụ thuộc (subjects seeded) — tránh lỗi FK.
async function removeUsers(prefix: string) {
  const users = await db.user.findMany({
    where: { username: { startsWith: prefix } },
    select: { id: true },
  })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return
  await db.subject.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
}

describe("Nhóm C — rate limit & bcrypt", () => {
  beforeEach(async () => {
    await db.loginAttempt.deleteMany()
  })

  // ── #6: rate limit theo IP (chặn brute-force phân tán nhiều username) ─
  it("✓ 20 lần sai từ 1 IP (nhiều username khác nhau) → username sạch cùng IP cũng bị chặn", async () => {
    const ip = "9.9.9.9"
    for (let i = 0; i < 20; i++) {
      await authorizeCredentials(`spray_user_${i}`, "wrong", ip)
    }
    // 'teacher' chưa từng sai, nhưng request đến từ IP đang bị giới hạn
    await expect(authorizeCredentials("teacher", "teacher123", ip)).rejects.toBeInstanceOf(
      RateLimitedError
    )
  }, 30_000)

  it("✓ Sai từ IP khác KHÔNG ảnh hưởng IP sạch (không khóa nhầm)", async () => {
    for (let i = 0; i < 20; i++) {
      await authorizeCredentials(`spray2_${i}`, "wrong", "5.5.5.5")
    }
    // IP khác hoàn toàn → login bình thường
    const user = await authorizeCredentials("teacher", "teacher123", "1.2.3.4")
    expect(user).not.toBeNull()
  }, 30_000)

  // ── #18: throttle đăng ký theo IP ──────────────────────────────────
  it("✓ Đăng ký quá nhiều lần từ 1 IP → TOO_MANY_REQUESTS", async () => {
    const ip = "8.8.8.8"
    const caller = callerWithIp(ip)
    const dupName = `rl_dup_${Date.now()}`

    // 1 lần thành công + 4 lần trùng tên (đều tính vào throttle theo IP)
    await caller.auth.register({ username: dupName, password: "Password123!", fullName: "" })
    for (let i = 0; i < 4; i++) {
      await caller.auth
        .register({ username: dupName, password: "Password123!", fullName: "" })
        .catch(() => {})
    }

    await expect(
      caller.auth.register({ username: `rl_over_${Date.now()}`, password: "Password123!", fullName: "" })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" })

    await removeUsers("rl_")
  }, 30_000)

  it("✓ Không có IP (null) → KHÔNG throttle đăng ký", async () => {
    const caller = callerWithIp(null)
    for (let i = 0; i < 6; i++) {
      await caller.auth
        .register({ username: `rl_noip_${Date.now()}_${i}`, password: "Password123!", fullName: "" })
        .catch(() => {})
    }
    // Lần thứ 7 vẫn không bị chặn vì IP null
    const ok = await caller.auth.register({
      username: `rl_noip_final_${Date.now()}`,
      password: "Password123!",
      fullName: "",
    })
    expect(ok.id).toBeDefined()
    await removeUsers("rl_noip")
  }, 30_000)

  // ── #19: bcrypt cost nhất quán (test = 4, không hardcode 12) ─────────
  it("✓ register hash mật khẩu theo BCRYPT_COST (test=4), không hardcode 12", async () => {
    const username = `cost_${Date.now()}`
    await callerWithIp(null).auth.register({ username, password: "Password123!", fullName: "" })
    const u = await db.user.findUniqueOrThrow({ where: { username } })
    // Định dạng bcrypt: $2a$<cost>$... — cost phải khớp BCRYPT_COST môi trường test (4)
    expect(u.passwordHash.split("$")[2]).toBe("04")
    await removeUsers(username)
  }, 30_000)
})
