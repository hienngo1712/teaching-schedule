import { describe, it, expect, beforeEach, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDayDate, vnDayKey } from "@/lib/activity"

const FAKE = "stat_fake_"
const DAY = 24 * 60 * 60 * 1000
let hash = ""

async function cleanup() {
  // user_activity_days xóa theo CASCADE.
  await db.user.deleteMany({ where: { username: { startsWith: FAKE } } })
}
async function fake(name: string, data: Record<string, unknown> = {}) {
  hash ||= await bcrypt.hash("x", 4)
  return db.user.create({ data: { username: FAKE + name, passwordHash: hash, ...data } })
}

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = `admin_test,${FAKE}admin`
  await cleanup()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await cleanup()
})

describe("admin.stats / admin.accountTrend — quyền", () => {
  it("giáo viên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.accountTrend({ days: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

describe("admin.stats — chênh lệch trước/sau khi thêm user giả (spec K nhóm A)", () => {
  it("mỗi thẻ tăng đúng theo trạng thái user giả; admin không tính", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.stats()
    const now = Date.now()
    await fake("plus", { plan: "plus", planExpiresAt: new Date(now + 10 * DAY), lastActiveAt: new Date(now - 60_000) })
    await fake("pro", { plan: "pro", planExpiresAt: new Date(now + 200 * DAY) })
    await fake("trial", { trialEndsAt: new Date(now + 5 * DAY) })
    await fake("std", { trialEndsAt: new Date(now - 5 * DAY), lastActiveAt: new Date(now - 3 * DAY) })
    await fake("locked", { isActive: false, plan: "pro", planExpiresAt: new Date(now + 100 * DAY) })
    // Đã xóa mềm (Q): không vào bất kỳ thẻ nào, kể cả hoạt động.
    const gone = await fake("deleted", { isDeleted: true, plan: "pro", planExpiresAt: new Date(now + 5 * DAY), lastActiveAt: new Date(now) })
    await db.userActivityDay.create({ data: { userId: gone.id, day: vnDayDate(new Date()), firstSeenAt: new Date() } })
    const adm = await fake("admin", { plan: "pro", planExpiresAt: new Date(now + 100 * DAY), lastActiveAt: new Date(now) })
    await db.userActivityDay.create({ data: { userId: adm.id, day: vnDayDate(new Date()), firstSeenAt: new Date() } })
    const std = await db.user.findUniqueOrThrow({ where: { username: FAKE + "std" } })
    await db.userActivityDay.create({ data: { userId: std.id, day: vnDayDate(new Date(now - 3 * DAY)), firstSeenAt: new Date(now - 3 * DAY) } })

    const after = await admin.admin.stats()
    expect(after.totalAccounts - before.totalAccounts).toBe(5)
    expect(after.activeAccounts - before.activeAccounts).toBe(4)
    expect(after.paying.plus - before.paying.plus).toBe(1)
    expect(after.paying.pro - before.paying.pro).toBe(1)
    expect(after.trial - before.trial).toBe(1)
    expect(after.expiringSoon.paid - before.expiringSoon.paid).toBe(1)
    expect(after.expiringSoon.trial - before.expiringSoon.trial).toBe(1)
    expect(after.standardAfterTrial - before.standardAfterTrial).toBe(1)
    expect(after.active24h - before.active24h).toBe(1)
    expect(after.active7d - before.active7d).toBe(1)
    // User giả mới tạo có adminSeenAt null: plus, pro, trial, std, locked → +5; deleted và admin không tính (R1).
    expect(after.newAccounts - before.newAccounts).toBe(5)
    expect(typeof after.updatedAt === "string" || after.updatedAt instanceof Date).toBe(true)
  })

  it("Active 24h / 7 ngày bỏ tài khoản bị khoá (spec U U26)", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.stats()
    const locked = await fake("locked_act", { isActive: false, lastActiveAt: new Date(Date.now() - 60_000) })
    await db.userActivityDay.create({ data: { userId: locked.id, day: vnDayDate(new Date()), firstSeenAt: new Date() } })
    const after = await admin.admin.stats()
    expect(after.active24h - before.active24h).toBe(0)
    expect(after.active7d - before.active7d).toBe(0)
  })

  it("Chờ duyệt đếm đơn đang chờ", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.stats()
    const u = await fake("buyer")
    await db.planOrder.create({ data: { userId: u.id, plan: "plus", period: "month", amount: 49000, code: "SFK00001", status: "pending" } })
    const after = await admin.admin.stats()
    expect(after.pendingOrders - before.pendingOrders).toBe(1)
    await db.planOrder.deleteMany({ where: { userId: u.id } })
  })
})

describe("admin.accountTrend (spec K nhóm T)", () => {
  it("mới theo ngày tạo VN; quay lại = hoạt động ngày khác ngày tạo; đăng ký hôm nay + dùng hôm nay chỉ là mới; admin không tính", async () => {
    const admin = await getAuthedCaller("admin_test")
    const now = new Date()
    const yesterday = new Date(now.getTime() - DAY)
    const today = vnDayKey(now)
    const yKey = vnDayKey(yesterday)
    const before = await admin.admin.accountTrend({ days: 7 })
    const pick = (t: typeof before, day: string) => t.days.find((d) => d.day === day)!

    const old = await fake("old", { createdAt: new Date(now.getTime() - 20 * DAY) })
    await db.userActivityDay.createMany({
      data: [
        { userId: old.id, day: vnDayDate(yesterday), firstSeenAt: yesterday },
        { userId: old.id, day: vnDayDate(now), firstSeenAt: now },
      ],
    })
    const fresh = await fake("fresh")
    await db.userActivityDay.create({ data: { userId: fresh.id, day: vnDayDate(now), firstSeenAt: now } })
    const adm = await fake("admin", { createdAt: new Date(now.getTime() - 20 * DAY) })
    await db.userActivityDay.create({ data: { userId: adm.id, day: vnDayDate(now), firstSeenAt: now } })
    // Đã xóa mềm: không tính mới, không tính quay lại.
    const gone = await fake("deleted2", { isDeleted: true, createdAt: new Date(now.getTime() - 20 * DAY) })
    await db.userActivityDay.create({ data: { userId: gone.id, day: vnDayDate(now), firstSeenAt: now } })
    await fake("deleted3", { isDeleted: true })

    const after = await admin.admin.accountTrend({ days: 7 })
    expect(after.days).toHaveLength(7)
    expect(after.days[6]).toMatchObject({ day: today, isToday: true })
    expect(pick(after, today).newAccounts - pick(before, today).newAccounts).toBe(1)
    expect(pick(after, today).returning - pick(before, today).returning).toBe(1)
    expect(pick(after, yKey).returning - pick(before, yKey).returning).toBe(1)
    expect(after.trackingSince! <= yKey).toBe(true)
    expect((await admin.admin.accountTrend({ days: 30 })).days).toHaveLength(30)
  })
})
