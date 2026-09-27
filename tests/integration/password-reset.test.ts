import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { authorizeCredentials } from "@/server/auth-credentials"
import { nodeJwt } from "@/server/auth-node-callbacks"
import { changeUserPassword } from "@/server/services/user.service"
import { currentEpoch } from "@/lib/session-policy"

const TARGET = "reset_target"
let targetId = 0

async function resetTarget() {
  await db.loginAttempt.deleteMany({ where: { username: TARGET } })
  await db.user.update({
    where: { id: targetId },
    data: { passwordHash: await bcrypt.hash("teacher123", 4), mustChangePassword: false, sessionVersion: 0 },
  })
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { username: TARGET } })
  targetId = (
    await db.user.create({ data: { username: TARGET, passwordHash: await bcrypt.hash("teacher123", 4) } })
  ).id
})
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await db.passwordResetLog.deleteMany({ where: { userId: targetId } })
  await resetTarget()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await db.passwordResetLog.deleteMany({ where: { userId: targetId } })
  await db.loginAttempt.deleteMany({ where: { username: TARGET } })
  // auth.me từ tháng 7 tự chạy lên lớp và ghi log có FK tới users.
  await db.classUpgradeLog.deleteMany({ where: { userId: targetId } })
  await db.user.deleteMany({ where: { username: TARGET } })
})

type P = Parameters<typeof nodeJwt>[0]

describe("admin.resetPassword (spec N R1–R3)", () => {
  it("admin reset → mật khẩu tạm đăng nhập được, pass cũ hết, cờ bật, sessionVersion +1, có log, phiên cũ bị đá", async () => {
    const oldToken = { userId: String(targetId), username: TARGET, fullName: null, epoch: currentEpoch(), sessionVersion: 0, iat: Math.floor(Date.now() / 1000) }
    const admin = await getAuthedCaller("admin_test")
    const r = await admin.admin.resetPassword({ userId: targetId })
    expect(r.username).toBe(TARGET)
    expect(r.tempPassword).toMatch(/^Lich-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)

    const u = await db.user.findUniqueOrThrow({ where: { id: targetId } })
    expect(u.mustChangePassword).toBe(true)
    expect(u.sessionVersion).toBe(1)
    expect(u.passwordHash).not.toContain(r.tempPassword)

    const logs = await db.passwordResetLog.findMany({ where: { userId: targetId } })
    expect(logs).toHaveLength(1)
    expect(logs[0].resetBy).toBe("admin_test")
    expect(Object.keys(logs[0]).sort()).toEqual(["createdAt", "id", "resetBy", "userId"])

    expect(await nodeJwt({ token: oldToken } as unknown as P)).toBeNull()
    expect(await authorizeCredentials(TARGET, "teacher123", null)).toBeNull()
    expect(await authorizeCredentials(TARGET, r.tempPassword, null)).toMatchObject({ mustChangePassword: true, sessionVersion: 1 })
  })

  it("giáo viên gọi → FORBIDDEN; reset tài khoản admin → FORBIDDEN; id không tồn tại → NOT_FOUND", async () => {
    const teacher = await getAuthedCaller("teacher")
    await expect(teacher.admin.resetPassword({ userId: targetId })).rejects.toMatchObject({ code: "FORBIDDEN" })
    const admin = await getAuthedCaller("admin_test")
    const adminId = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
    await expect(admin.admin.resetPassword({ userId: adminId })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.admin.resetPassword({ userId: 999_999 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await db.passwordResetLog.count({ where: { userId: targetId } })).toBe(0)
  })

  it("đang bị bắt đổi mật khẩu → tRPC nghiệp vụ FORBIDDEN; đổi xong hết chặn", async () => {
    const { tempPassword } = await (await getAuthedCaller("admin_test")).admin.resetPassword({ userId: targetId })
    const blocked = await getAuthedCaller(TARGET)
    await expect(blocked.auth.me()).rejects.toMatchObject({ code: "FORBIDDEN", message: "MUST_CHANGE_PASSWORD" })
    await expect(blocked.plan.me()).rejects.toMatchObject({ code: "FORBIDDEN" })

    await changeUserPassword(db, targetId, tempPassword, "MoiSauReset@2026")
    const freed = await getAuthedCaller(TARGET)
    await expect(freed.auth.me()).resolves.toMatchObject({ username: TARGET })
  })
})
