import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authorizeCredentials, RateLimitedError } from "@/server/auth-credentials"
import { db } from "@/server/db"
import bcrypt from "bcryptjs"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { changeUserPassword } from "@/server/services/user.service"

describe("Auth — authorizeCredentials", () => {
  beforeEach(async () => {
    // Reset login attempts trước mỗi test để không lẫn rate limit
    await db.loginAttempt.deleteMany()
  })

  it("✓ Login đúng → trả user + ghi LoginAttempt success=true + cập nhật lastLoginAt", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(before.lastLoginAt).toBeNull()

    const user = await authorizeCredentials("teacher", "teacher123", "127.0.0.1")
    expect(user).not.toBeNull()
    expect(user!.username).toBe("teacher")
    expect(user!.sessionVersion).toBe(0)
    expect(user!.mustChangePassword).toBe(false)

    const attempt = await db.loginAttempt.findFirst({
      where: { username: "teacher" },
      orderBy: { createdAt: "desc" },
    })
    expect(attempt?.success).toBe(true)
    expect(attempt?.ipAddress).toBe("127.0.0.1")

    const after = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(after.lastLoginAt).not.toBeNull()
  })

  it("✗ Login sai password → trả null + ghi LoginAttempt success=false", async () => {
    const user = await authorizeCredentials("teacher", "wrong-password", null)
    expect(user).toBeNull()

    const attempt = await db.loginAttempt.findFirst({
      where: { username: "teacher" },
      orderBy: { createdAt: "desc" },
    })
    expect(attempt?.success).toBe(false)
  })

  it("✗ Login username không tồn tại → trả null + LoginAttempt với userId=null", async () => {
    const user = await authorizeCredentials("ghost-user", "any-pass", null)
    expect(user).toBeNull()

    const attempt = await db.loginAttempt.findFirst({
      where: { username: "ghost-user" },
      orderBy: { createdAt: "desc" },
    })
    expect(attempt?.success).toBe(false)
    expect(attempt?.userId).toBeNull()
  })

  it("✗ User bị deactivate → trả null", async () => {
    await db.user.create({
      data: {
        username: "inactive-user",
        passwordHash: await bcrypt.hash("teacher123", 4),
        isActive: false,
      },
    })
    const user = await authorizeCredentials("inactive-user", "teacher123", null)
    expect(user).toBeNull()

    await db.user.deleteMany({ where: { username: "inactive-user" } })
  })

  it("✗ 5 lần sai liên tiếp → lần 6 throw RATE_LIMITED dù đúng password", async () => {
    for (let i = 0; i < 5; i++) {
      await authorizeCredentials("teacher", "wrong", null)
    }

    await expect(authorizeCredentials("teacher", "teacher123", null)).rejects.toBeInstanceOf(
      RateLimitedError
    )
  })

  it("✓ Sau 15 phút → rate limit reset, login lại được", async () => {
    // Tạo 5 LoginAttempt thất bại đã quá 15 phút
    const oldDate = new Date(Date.now() - 16 * 60 * 1000)
    for (let i = 0; i < 5; i++) {
      await db.loginAttempt.create({
        data: { username: "teacher", success: false, createdAt: oldDate },
      })
    }

    const user = await authorizeCredentials("teacher", "teacher123", null)
    expect(user).not.toBeNull()
  })
})

describe("Auth router — me", () => {
  it("✓ auth.me → trả user info", async () => {
    const caller = await getAuthedCaller()
    const me = await caller.auth.me()
    expect(me.username).toBe("teacher")
    expect(me).toHaveProperty("fullName")
  })

  it("✗ auth.me không có session → UNAUTHORIZED", async () => {
    await expect(publicCaller.auth.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })
})

describe("changeUserPassword (spec N Q15–Q16, R2)", () => {
  afterEach(async () => {
    await db.user.update({
      where: { username: "teacher" },
      data: { passwordHash: await bcrypt.hash("teacher123", 4), sessionVersion: 0, mustChangePassword: false },
    })
    await db.loginAttempt.deleteMany()
  })

  it("✓ đúng mật khẩu cũ → pass mới đăng nhập được, pass cũ hết, sessionVersion +1, tắt mustChangePassword", async () => {
    const before = await db.user.update({ where: { username: "teacher" }, data: { mustChangePassword: true } })
    await changeUserPassword(db, before.id, "teacher123", "NewSecret@2026")
    const after = await db.user.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
    expect(after.mustChangePassword).toBe(false)
    await db.loginAttempt.deleteMany()
    expect(await authorizeCredentials("teacher", "teacher123", null)).toBeNull()
    expect(await authorizeCredentials("teacher", "NewSecret@2026", null)).toMatchObject({
      sessionVersion: before.sessionVersion + 1,
      mustChangePassword: false,
    })
  })

  it("✗ sai mật khẩu cũ → BAD_REQUEST, hash và sessionVersion giữ nguyên", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await expect(changeUserPassword(db, before.id, "wrong-password", "AnotherSecret@2026")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Mật khẩu hiện tại không đúng",
    })
    const after = await db.user.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.passwordHash).toBe(before.passwordHash)
    expect(after.sessionVersion).toBe(before.sessionVersion)
  })
})
