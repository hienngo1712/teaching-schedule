import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { addDays, daysLeft, effectivePlan, planBanner, trialEndFor, vnStartOfDay } from "@/lib/plans"
import { getDefaultTrialDays } from "@/server/services/trial.service"

const FAKE = "trial_test_"
const FAR = new Date("2099-12-31T17:00:00.000Z")
const PASSWORD = "Password123!"

async function reset() {
  // tests/setup.ts không xóa bảng này: trả mặc định về 60 (chỉ giữ dòng seed migration).
  await db.trialDayChange.deleteMany({ where: { changedBy: { not: "migration" } } })
  await db.subject.deleteMany({ where: { user: { username: { startsWith: FAKE } } } })
  await db.user.deleteMany({ where: { username: { startsWith: FAKE } } })
}

async function makeUser(suffix: string, createdDaysAgo: number, trialDays: number | null, extra: { plan?: string; planExpiresAt?: Date } = {}) {
  const createdAt = addDays(new Date(), -createdDaysAgo)
  return db.user.create({
    data: {
      username: `${FAKE}${suffix}`,
      passwordHash: "x",
      createdAt,
      trialEndsAt: trialDays === null ? null : trialEndFor(createdAt, trialDays),
      ...extra,
    },
  })
}

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await reset()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await reset()
})

describe("admin.* dùng thử — quyền", () => {
  it("giáo viên → FORBIDDEN cả 4 procedure, không ghi gì", async () => {
    const t = await getAuthedCaller("teacher_std")
    const std = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    await expect(t.admin.trialSettings()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.updateTrialDays({ days: 90, expected: 60 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.setUserTrial({ userId: std.id, days: 120 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.userTrialChanges({ userId: std.id })).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(await db.trialDayChange.count({ where: { changedBy: { not: "migration" } } })).toBe(0)
  })
})

describe("số ngày dùng thử mặc định (T1, T2)", () => {
  it("admin xem: 60 ngày, lịch sử có dòng seed", async () => {
    const s = await (await getAuthedCaller("admin_test")).admin.trialSettings()
    expect(s.days).toBe(60)
    expect(s.history.map((h) => [h.days, h.previousDays, h.changedBy])).toContainEqual([60, null, "migration"])
  })

  it("đổi 60 → 90: tài khoản đăng ký sau nhận 90 ngày, tài khoản đang dùng thử giữ hạn cũ", async () => {
    const admin = await getAuthedCaller("admin_test")
    const old = await makeUser("old", 5, 60)
    await expect(admin.admin.updateTrialDays({ days: 90, expected: 60 })).resolves.toEqual({ days: 90 })
    const before = new Date()
    await publicCaller.auth.register({ username: `${FAKE}reg90`, password: PASSWORD })
    const reg = await db.user.findUniqueOrThrow({ where: { username: `${FAKE}reg90` } })
    expect(reg.trialEndsAt?.toISOString()).toBe(trialEndFor(before, 90)?.toISOString())
    expect((await db.user.findUniqueOrThrow({ where: { id: old.id } })).trialEndsAt?.toISOString()).toBe(
      trialEndFor(old.createdAt, 60)?.toISOString()
    )
    const s = await admin.admin.trialSettings()
    expect(s.days).toBe(90)
    expect(s.history[0]).toMatchObject({ days: 90, previousDays: 60, changedBy: "admin_test" })
  })

  it("Review Focus 3: mặc định 0 → tài khoản mới không dùng thử (trialEndsAt null), không có banner", async () => {
    await (await getAuthedCaller("admin_test")).admin.updateTrialDays({ days: 0, expected: 60 })
    await publicCaller.auth.register({ username: `${FAKE}reg0`, password: PASSWORD })
    const reg = await db.user.findUniqueOrThrow({ where: { username: `${FAKE}reg0` } })
    expect(reg.trialEndsAt).toBeNull()
    expect(effectivePlan(reg, new Date()).plan).toBe("standard")
    expect(planBanner(reg, new Date(), false)).toBeNull()
  })

  it("expected sai → CONFLICT; không đổi → BAD_REQUEST; ngoài 0–365 / không nguyên → BAD_REQUEST; không ghi dòng", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updateTrialDays({ days: 90, expected: 45 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Số ngày dùng thử vừa được đổi ở nơi khác, tải lại để xem",
    })
    await expect(admin.admin.updateTrialDays({ days: 60, expected: 60 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Số ngày dùng thử chưa thay đổi",
    })
    for (const days of [-1, 366, 1.5]) {
      await expect(admin.admin.updateTrialDays({ days, expected: 60 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }
    expect(await db.trialDayChange.count({ where: { changedBy: { not: "migration" } } })).toBe(0)
  })

  it("hiện hành = dòng id lớn nhất dù createdAt sớm hơn (spec P L3)", async () => {
    const row = await db.trialDayChange.create({
      data: { userId: null, days: 45, previousDays: 60, changedBy: "test-p-l3", createdAt: new Date("2000-01-01T00:00:00Z") },
    })
    try {
      expect(await getDefaultTrialDays(db)).toBe(45)
    } finally {
      await db.trialDayChange.delete({ where: { id: row.id } })
    }
  })
})

describe("đặt riêng từng tài khoản (T3)", () => {
  it("đã dùng 50 ngày, đặt 120 → hạn = đầu ngày tạo + 120, còn 70 ngày; ghi lịch sử 60 → 120; mặc định không đổi", async () => {
    const admin = await getAuthedCaller("admin_test")
    const u = await makeUser("u50", 50, 60)
    const res = await admin.admin.setUserTrial({ userId: u.id, days: 120 })
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.trialEndsAt?.toISOString()).toBe(addDays(vnStartOfDay(u.createdAt), 120).toISOString())
    expect(res.trialEndsAt).toEqual(after.trialEndsAt)
    expect(daysLeft(after.trialEndsAt!, new Date())).toBe(70)
    const changes = await admin.admin.userTrialChanges({ userId: u.id })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ days: 120, previousDays: 60, changedBy: "admin_test" })
    expect((await admin.admin.trialSettings()).days).toBe(60)
  })

  it("trial đã hết → đặt 120 thì bật lại (Pro dùng thử); đặt 30 (mốc quá khứ) thì hết dùng thử", async () => {
    const admin = await getAuthedCaller("admin_test")
    const u = await makeUser("expired", 100, 60)
    expect(effectivePlan(u, new Date()).source).toBe("free")
    await admin.admin.setUserTrial({ userId: u.id, days: 120 })
    const on = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(effectivePlan(on, new Date())).toMatchObject({ plan: "pro", source: "trial" })
    expect(daysLeft(on.trialEndsAt!, new Date())).toBe(20)
    await admin.admin.setUserTrial({ userId: u.id, days: 30 })
    const off = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(off.trialEndsAt!.getTime()).toBeLessThan(Date.now())
    expect(effectivePlan(off, new Date()).source).toBe("free")
  })

  it("không đụng gói trả phí: Pro tới 2099 giữ nguyên plan/planExpiresAt", async () => {
    const u = await makeUser("paid", 100, 60, { plan: "pro", planExpiresAt: FAR })
    await (await getAuthedCaller("admin_test")).admin.setUserTrial({ userId: u.id, days: 120 })
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.plan).toBe("pro")
    expect(after.planExpiresAt).toEqual(FAR)
  })

  it("Review Focus 4: tài khoản cũ (chưa có dùng thử, tạo 400 ngày trước) đặt 90 → mốc quá khứ, không dùng thử, số ngày cũ null; đặt 0 → null", async () => {
    const admin = await getAuthedCaller("admin_test")
    const u = await makeUser("legacy", 400, null)
    await admin.admin.setUserTrial({ userId: u.id, days: 90 })
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.trialEndsAt!.getTime()).toBeLessThan(Date.now())
    expect(effectivePlan(after, new Date()).plan).toBe("standard")
    expect((await admin.admin.userTrialChanges({ userId: u.id }))[0]).toMatchObject({ days: 90, previousDays: null })
    await admin.admin.setUserTrial({ userId: u.id, days: 0 })
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).trialEndsAt).toBeNull()
  })

  it("user không tồn tại → NOT_FOUND; số ngày > 3650 → BAD_REQUEST", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.setUserTrial({ userId: 999999, days: 90 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    const u = await makeUser("range", 10, 60)
    await expect(admin.admin.setUserTrial({ userId: u.id, days: 3651 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("đặt dùng thử cho tài khoản admin → FORBIDDEN, không ghi lịch sử (spec P L1)", async () => {
    const admin = await getAuthedCaller("admin_test")
    const adminUser = await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })
    const before = await db.trialDayChange.count({ where: { userId: adminUser.id } })
    await expect(admin.admin.setUserTrial({ userId: adminUser.id, days: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(await db.trialDayChange.count({ where: { userId: adminUser.id } })).toBe(before)
  })

  it("2 lần đặt cùng lúc → lịch sử nối tiếp đúng (previousDays lần sau = days lần trước) (spec P L2)", async () => {
    const admin = await getAuthedCaller("admin_test")
    const std = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    await Promise.all([
      admin.admin.setUserTrial({ userId: std.id, days: 30 }),
      admin.admin.setUserTrial({ userId: std.id, days: 90 }),
    ])
    const rows = await db.trialDayChange.findMany({ where: { userId: std.id }, orderBy: { id: "desc" }, take: 2 })
    expect(rows[0].previousDays).toBe(rows[1].days)
  })
})
