import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import pkg from "../../package.json"

const SEED = ["teacher", "teacher2", "admin_test"]

async function clean() {
  await db.feedback.deleteMany()
  await db.userActivityDay.deleteMany({ where: { user: { username: { in: SEED } } } })
  await db.user.updateMany({ where: { username: { in: SEED } }, data: { feedbackPromptAt: null } })
}

async function addActiveDays(username: string, n: number) {
  const u = await db.user.findUniqueOrThrow({ where: { username } })
  await db.userActivityDay.createMany({
    data: Array.from({ length: n }, (_, i) => ({ userId: u.id, day: new Date(Date.UTC(2026, 0, i + 1)), firstSeenAt: new Date() })),
  })
}

describe("feedback (spec AB §3.2)", () => {
  beforeEach(async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    await clean()
  })
  afterEach(async () => {
    delete process.env.ADMIN_USERNAMES
    await clean()
    // Trả lại như tests/setup.ts để e2e không bị hộp tự hỏi.
    await db.user.updateMany({ where: { username: { in: SEED } }, data: { feedbackPromptAt: new Date() } })
  })

  it("submit lưu đúng, trim, message rỗng → null, bản lấy từ server, đặt feedbackPromptAt", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.feedback.submit({ rating: 4, message: "  Thêm xuất PDF  ", page: "/students" })
    await caller.feedback.submit({ rating: 5, message: "   ", page: "/dashboard" })
    const rows = await db.feedback.findMany({ orderBy: { id: "asc" } })
    expect(rows.map((r) => [r.rating, r.message, r.page])).toEqual([[4, "Thêm xuất PDF", "/students"], [5, null, "/dashboard"]])
    expect(rows[0].appVersion).toBe(pkg.version)
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(u.feedbackPromptAt).not.toBeNull()
  })

  it("rating 0, 6, 1.5 và message > 1000 bị BAD_REQUEST", async () => {
    const caller = await getAuthedCaller("teacher")
    for (const rating of [0, 6, 1.5]) {
      await expect(caller.feedback.submit({ rating, page: "/" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }
    await expect(caller.feedback.submit({ rating: 3, message: "a".repeat(1001), page: "/" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.feedback.count()).toBe(0)
  })

  it("admin bị FORBIDDEN ở cả 3 thủ tục", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.feedback.submit({ rating: 5, page: "/" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.feedback.promptStatus()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.feedback.dismissPrompt()).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("lần thứ 6 trong 24 giờ bị TOO_MANY_REQUESTS; góp ý cũ hơn 24 giờ không tính", async () => {
    const caller = await getAuthedCaller("teacher")
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.feedback.create({ data: { userId: u.id, rating: 3, page: "/", appVersion: "0", createdAt: new Date(Date.now() - 25 * 3600_000) } })
    for (let i = 0; i < 5; i++) await caller.feedback.submit({ rating: 5, page: "/" })
    await expect(caller.feedback.submit({ rating: 5, page: "/" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" })
    // Giới hạn tính theo từng tài khoản.
    await (await getAuthedCaller("teacher2")).feedback.submit({ rating: 5, page: "/" })
  })

  it("promptStatus: cần đủ 7 ngày dùng, chưa hỏi, chưa gửi", async () => {
    const caller = await getAuthedCaller("teacher")
    await addActiveDays("teacher", 6)
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: false })
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.userActivityDay.create({ data: { userId: u.id, day: new Date(Date.UTC(2026, 1, 1)), firstSeenAt: new Date() } })
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: true })

    await caller.feedback.dismissPrompt()
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: false })
  })

  it("đã gửi góp ý (dù feedbackPromptAt bị xoá) thì không hỏi", async () => {
    const caller = await getAuthedCaller("teacher")
    await addActiveDays("teacher", 7)
    await caller.feedback.submit({ rating: 2, page: "/" })
    await db.user.update({ where: { username: "teacher" }, data: { feedbackPromptAt: null } })
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: false })
  })

  it("dismissPrompt chỉ ghi lần đầu", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.feedback.dismissPrompt()
    const first = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).feedbackPromptAt
    await new Promise((r) => setTimeout(r, 5))
    await caller.feedback.dismissPrompt()
    const second = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).feedbackPromptAt
    expect(second?.getTime()).toBe(first?.getTime())
  })

  it("admin.feedbackList: mới nhất trước, 50/trang, trung bình 1 chữ số, đếm sao; giáo viên bị FORBIDDEN", async () => {
    const t = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.feedback.createMany({
      data: Array.from({ length: 52 }, (_, i) => ({ userId: t.id, rating: (i % 5) + 1, message: `m${i}`, page: "/", appVersion: "0.13.0" })),
    })
    const admin = await getAuthedCaller("admin_test")
    const p1 = await admin.admin.feedbackList({})
    expect(p1.items).toHaveLength(50)
    expect(p1.items[0].message).toBe("m51")
    expect(p1.items[0]).toMatchObject({ username: "teacher" })
    expect(p1.total).toBe(52)
    expect(p1.counts).toEqual({ 1: 11, 2: 11, 3: 10, 4: 10, 5: 10 })
    expect(p1.average).toBe(2.9) // (11+22+30+40+50)/52 = 2.94 → 2.9
    expect(p1.nextCursor).not.toBeNull()
    const p2 = await admin.admin.feedbackList({ cursor: p1.nextCursor! })
    expect(p2.items.map((i) => i.message)).toEqual(["m1", "m0"])
    expect(p2.nextCursor).toBeNull()
    await expect((await getAuthedCaller("teacher")).admin.feedbackList({})).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("chưa có góp ý → average null, counts toàn 0", async () => {
    const res = await (await getAuthedCaller("admin_test")).admin.feedbackList({})
    expect(res).toMatchObject({ items: [], total: 0, average: null, nextCursor: null, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  })
})
