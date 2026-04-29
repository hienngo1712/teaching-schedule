import { describe, it, expect, beforeEach } from "vitest"
import { authorizeCredentials, RateLimitedError } from "@/server/auth-credentials"
import { db } from "@/server/db"
import bcrypt from "bcrypt"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"

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

describe("Auth router — me / changePassword", () => {
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

  it("✓ auth.changePassword đúng currentPassword → đổi thành công + login với pass mới", async () => {
    // Reset password về default trước test (test trước có thể đã đổi)
    await db.user.update({
      where: { username: "teacher" },
      data: { passwordHash: await bcrypt.hash("teacher123", 4) },
    })
    await db.loginAttempt.deleteMany()

    const caller = await getAuthedCaller()
    const result = await caller.auth.changePassword({
      currentPassword: "teacher123",
      newPassword: "NewSecret@2026",
    })
    expect(result.success).toBe(true)

    // Login với pass cũ → fail
    expect(await authorizeCredentials("teacher", "teacher123", null)).toBeNull()
    // Login với pass mới → OK
    expect(
      await authorizeCredentials("teacher", "NewSecret@2026", null)
    ).not.toBeNull()

    // Restore
    await db.user.update({
      where: { username: "teacher" },
      data: { passwordHash: await bcrypt.hash("teacher123", 4) },
    })
  })

  it("✗ auth.changePassword sai currentPassword → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.auth.changePassword({
        currentPassword: "wrong-password",
        newPassword: "AnotherSecret@2026",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✗ auth.changePassword newPassword < 10 ký tự → validation error", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.auth.changePassword({
        currentPassword: "teacher123",
        newPassword: "short",
      })
    ).rejects.toThrow()
  })
})
