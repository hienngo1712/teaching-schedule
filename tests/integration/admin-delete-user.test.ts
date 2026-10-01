import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { authorizeCredentials, getSessionUserState } from "@/server/auth-credentials"
import { registerUser } from "@/server/services/user.service"
import { getParentView } from "@/server/services/parent-link.service"
import { hashParentToken } from "@/server/crypto/parent-token"
import { getAuthedCaller } from "../helpers/trpc"

const NAME = "q_del_user"
const PASS = "matkhau-q-123"
const TOKEN = "d".repeat(43)

async function removeTestUser() {
  const u = await db.user.findUnique({ where: { username: NAME } })
  if (!u) return
  await db.loginAttempt.deleteMany({ where: { OR: [{ userId: u.id }, { username: NAME }] } })
  await db.classUpgradeLog.deleteMany({ where: { userId: u.id } })
  await db.planOrder.deleteMany({ where: { userId: u.id } })
  await db.student.deleteMany({ where: { userId: u.id } })
  await db.subject.deleteMany({ where: { userId: u.id } })
  await db.user.delete({ where: { id: u.id } })
}

async function createTestUser() {
  // Pro để link phụ huynh sống (spec G D9), chỉ còn cờ xoá quyết định 404.
  const u = await db.user.create({
    data: { username: NAME, passwordHash: await bcrypt.hash(PASS, 4), fullName: "GV Xoá", plan: "pro", planExpiresAt: new Date("2099-12-31T17:00:00.000Z") },
  })
  await db.student.create({
    data: { userId: u.id, fullName: "HS của GV xoá", grade: 4, parentLinkToken: TOKEN, parentLinkTokenHash: hashParentToken(TOKEN) },
  })
  return u
}

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await removeTestUser()
})
afterAll(async () => {
  await removeTestUser()
  delete process.env.ADMIN_USERNAMES
})

describe("admin xoá / khôi phục tài khoản (spec Q mục 8)", () => {
  it("quyền: giáo viên → FORBIDDEN; xoá tài khoản admin → FORBIDDEN; id lạ → NOT_FOUND", async () => {
    const u = await createTestUser()
    const teacher = await getAuthedCaller("teacher")
    await expect(teacher.admin.deleteUser({ userId: u.id })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(teacher.admin.deletedUsers()).rejects.toMatchObject({ code: "FORBIDDEN" })
    const admin = await getAuthedCaller("admin_test")
    const adminId = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
    await expect(admin.admin.deleteUser({ userId: adminId })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.admin.deleteUser({ userId: 99_999_999 })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("xoá: cờ + version, phiên chết, đăng nhập như sai mật khẩu, tên vẫn giữ, link phụ huynh 404, ẩn khỏi overview", async () => {
    const u = await createTestUser()
    const admin = await getAuthedCaller("admin_test")
    expect(await getSessionUserState(u.id, 0)).not.toBeNull()
    expect(await getParentView(db, TOKEN)).not.toBeNull()

    await admin.admin.deleteUser({ userId: u.id })

    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(row).toMatchObject({ isDeleted: true, deletedBy: "admin_test", sessionVersion: 1 })
    expect(row.deletedAt).toBeInstanceOf(Date)
    expect(await getSessionUserState(u.id, 0)).toBeNull()
    expect(await getSessionUserState(u.id, 1)).toBeNull()
    expect(await authorizeCredentials(NAME, PASS, null)).toBeNull()
    expect(await db.loginAttempt.count({ where: { username: NAME, success: false } })).toBe(1)
    await expect(registerUser(db, { username: NAME, password: "khac-hoan-toan-1", fullName: "" })).rejects.toThrow(/đã tồn tại/)
    expect(await getParentView(db, TOKEN)).toBeNull()

    const ov = await admin.admin.overview()
    expect(ov.users.map((x) => x.id)).not.toContain(u.id)
    const deleted = await admin.admin.deletedUsers()
    expect(deleted[0]).toMatchObject({ id: u.id, username: NAME, fullName: "GV Xoá", deletedBy: "admin_test" })
    await expect(admin.admin.deleteUser({ userId: u.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("tài khoản đã xoá: reset mật khẩu / đặt gói / đặt dùng thử / duyệt đơn → NOT_FOUND; đơn chờ bị ẩn", async () => {
    const u = await createTestUser()
    const order = await db.planOrder.create({ data: { userId: u.id, plan: "plus", period: "1m", amount: 99_000, code: "QDEL01", status: "pending" } })
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.deleteUser({ userId: u.id })
    await expect(admin.admin.resetPassword({ userId: u.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(admin.admin.setPlan({ userId: u.id, plan: "pro", lastDay: "2099-01-01", note: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(admin.admin.setUserTrial({ userId: u.id, days: 30 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await admin.admin.overview()).pendingOrders.map((o) => o.id)).not.toContain(order.id)
    await expect(admin.admin.approveOrder({ id: order.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("pending")
  })

  it("khôi phục: đăng nhập lại được, hiện lại ở overview, khôi phục lần 2 → NOT_FOUND", async () => {
    const u = await createTestUser()
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.deleteUser({ userId: u.id })
    await admin.admin.restoreUser({ userId: u.id })
    expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ isDeleted: false, deletedAt: null, deletedBy: null })
    expect((await authorizeCredentials(NAME, PASS, null))?.username).toBe(NAME)
    expect((await admin.admin.overview()).users.map((x) => x.id)).toContain(u.id)
    await expect(admin.admin.restoreUser({ userId: u.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("U17: adminRestoreUser -> log console.info chứa username của user", async () => {
    const u = await createTestUser()
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.deleteUser({ userId: u.id })

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    try {
      await admin.admin.restoreUser({ userId: u.id })
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[admin] admin_test khôi phục tài khoản ${NAME} (user ${u.id})`)
      )
    } finally {
      infoSpy.mockRestore()
    }
  })
})
