import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { nodeJwt } from "@/server/auth-node-callbacks"
import { currentEpoch } from "@/lib/session-policy"
import { vnDayDate } from "@/lib/activity"

type P = Parameters<typeof nodeJwt>[0]
let stdId = 0
let adminId = 0

const token = (userId: number, username: string) => ({
  userId: String(userId),
  username,
  fullName: null,
  remember: false,
  epoch: currentEpoch(),
  sessionVersion: 0,
  mustChangePassword: false,
  iat: Math.floor(Date.now() / 1000) - 60,
})
const call = (userId: number, username: string) => nodeJwt({ token: token(userId, username) } as unknown as P)
const rows = (userId: number) => db.userActivityDay.findMany({ where: { userId }, orderBy: { day: "asc" } })

async function reset() {
  await db.userActivityDay.deleteMany({ where: { userId: { in: [stdId, adminId] } } })
  await db.user.updateMany({ where: { id: { in: [stdId, adminId] } }, data: { lastActiveAt: null } })
}

beforeAll(async () => {
  stdId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
  adminId = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
})
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  vi.restoreAllMocks()
  await reset()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  vi.restoreAllMocks()
  await reset()
})

describe("ghi hoạt động qua nodeJwt (spec K nhóm B)", () => {
  it("lần đầu → 1 dòng hôm nay + last_active_at; gọi lại ngay → không ghi thêm, updated_at không đổi", async () => {
    expect(await call(stdId, "teacher_std")).not.toBeNull()
    const r1 = await rows(stdId)
    expect(r1).toHaveLength(1)
    expect(r1[0].day).toEqual(vnDayDate(new Date()))
    const u1 = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    expect(Math.abs(u1.lastActiveAt!.getTime() - Date.now())).toBeLessThan(10_000)

    await call(stdId, "teacher_std")
    const u2 = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    expect(await rows(stdId)).toHaveLength(1)
    expect(u2.lastActiveAt).toEqual(u1.lastActiveAt)
    expect(u2.updatedAt).toEqual(u1.updatedAt)
  })

  it("last_active_at lùi 2 giờ (cùng ngày) → cập nhật mốc, vẫn 1 dòng (ON CONFLICT DO NOTHING)", async () => {
    await call(stdId, "teacher_std")
    const before = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    const twoHoursAgo = new Date(before.lastActiveAt!.getTime() - 2 * 60 * 60 * 1000)
    await db.user.update({ where: { id: stdId }, data: { lastActiveAt: twoHoursAgo } })
    await call(stdId, "teacher_std")
    const after = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    expect(after.lastActiveAt!.getTime()).toBeGreaterThan(twoHoursAgo.getTime() + 60 * 60 * 1000)
    // Nếu 2 giờ trước là hôm qua giờ VN (chạy test lúc 00:00–02:00 VN) thì có thêm dòng hôm qua? Không: chỉ ghi ngày của now.
    expect((await rows(stdId)).map((r) => r.day)).toEqual([vnDayDate(new Date())])
  })

  it("last_active_at là hôm qua → thêm dòng hôm nay", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await db.userActivityDay.create({ data: { userId: stdId, day: vnDayDate(yesterday), firstSeenAt: yesterday } })
    await db.user.update({ where: { id: stdId }, data: { lastActiveAt: yesterday } })
    await call(stdId, "teacher_std")
    expect((await rows(stdId)).map((r) => r.day)).toEqual([vnDayDate(yesterday), vnDayDate(new Date())])
  })

  it("gọi 2 lần song song → vẫn 1 dòng, không lỗi", async () => {
    const res = await Promise.all([call(stdId, "teacher_std"), call(stdId, "teacher_std")])
    expect(res.every((t) => t !== null)).toBe(true)
    expect(await rows(stdId)).toHaveLength(1)
  })

  it("admin → không ghi gì", async () => {
    expect(await call(adminId, "admin_test")).not.toBeNull()
    expect(await rows(adminId)).toHaveLength(0)
    expect((await db.user.findUniqueOrThrow({ where: { id: adminId } })).lastActiveAt).toBeNull()
  })

  it("ghi lỗi → nodeJwt vẫn trả token, chỉ console.warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("boom"))
    const t = await call(stdId, "teacher_std")
    expect(t).not.toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(await rows(stdId)).toHaveLength(0)
  })
})
