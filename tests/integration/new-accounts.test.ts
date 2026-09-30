import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"

const FAKE = "nacc_fake_"
const PASSWORD = "matkhau-test-123"

async function cleanup() {
  const ids = (await db.user.findMany({ where: { username: { startsWith: FAKE } }, select: { id: true } })).map((u) => u.id)
  if (ids.length === 0) return
  // registerUser seed môn học mặc định; bảng con có FK RESTRICT phải xóa trước (thêm bảng của Q nếu có, ghi Ruling).
  await db.planOrder.deleteMany({ where: { userId: { in: ids } } })
  await db.trialDayChange.deleteMany({ where: { userId: { in: ids } } })
  await db.subject.deleteMany({ where: { userId: { in: ids } } })
  await db.classUpgradeLog.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
}
async function register(name: string) {
  await publicCaller.auth.register({ consent: CONSENT_ACCEPTED,  username: FAKE + name, password: PASSWORD, fullName: "Tài khoản " + name })
  return db.user.findUniqueOrThrow({ where: { username: FAKE + name } })
}
const names = async () => (await (await getAuthedCaller("admin_test")).admin.newAccounts()).items.map((i) => i.username)

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = `admin_test,${FAKE}admin`
  await cleanup()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await cleanup()
})

describe("admin.newAccounts / markAccountsSeen (spec K nhóm R)", () => {
  it("giáo viên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.newAccounts()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.markAccountsSeen({ all: true })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("đăng ký → xuất hiện đầu danh sách, pendingCount.newAccounts +1; đánh dấu đã xem → biến mất, gọi lại không đổi mốc", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.pendingCount()
    const u = await register("a")
    const list = await admin.admin.newAccounts()
    expect(list.items[0]).toMatchObject({ id: u.id, username: FAKE + "a", fullName: "Tài khoản a" })
    expect(typeof list.items[0].plan).toBe("string")
    expect((await admin.admin.pendingCount()).newAccounts - before.newAccounts).toBe(1)

    expect(await admin.admin.markAccountsSeen({ userIds: [u.id] })).toEqual({ count: 1 })
    expect(await names()).not.toContain(FAKE + "a")
    const seenAt = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).adminSeenAt
    expect(seenAt).not.toBeNull()
    expect(await admin.admin.markAccountsSeen({ userIds: [u.id] })).toEqual({ count: 0 })
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).adminSeenAt).toEqual(seenAt)
  })

  it("{ all: true } → danh sách rỗng, count lần 2 = 0", async () => {
    await register("b")
    await register("c")
    const admin = await getAuthedCaller("admin_test")
    const r = await admin.admin.markAccountsSeen({ all: true })
    expect(r.count).toBeGreaterThanOrEqual(2)
    expect((await admin.admin.newAccounts()).total).toBe(0)
    expect(await admin.admin.markAccountsSeen({ all: true })).toEqual({ count: 0 })
  })

  it("không hiện admin và tài khoản đã xóa mềm", async () => {
    await register("admin")
    const gone = await register("gone")
    await db.user.update({ where: { id: gone.id }, data: { isDeleted: true } })
    const list = await names()
    expect(list).not.toContain(FAKE + "admin")
    expect(list).not.toContain(FAKE + "gone")
  })

  it("câu backfill của migration làm tài khoản có sẵn thành đã xem", async () => {
    const old = await register("old")
    expect(await names()).toContain(FAKE + "old")
    const dir = join(process.cwd(), "prisma", "migrations")
    const sql = readFileSync(join(dir, readdirSync(dir).find((d) => d.endsWith("_add_user_activity"))!, "migration.sql"), "utf8")
    const backfill = sql.match(/^UPDATE "users" SET "admin_seen_at" = .*;$/m)![0]
    // Giới hạn vào user giả để không đụng tài khoản seed.
    await db.$executeRawUnsafe(backfill.replace(/;$/, ` AND "id" = ${old.id};`))
    expect(await names()).not.toContain(FAKE + "old")
  })

  it("setPlan / setUserTrial tự đánh dấu đã xem", async () => {
    const p = await register("plan")
    const t = await register("trial")
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.setPlan({ userId: p.id, plan: "standard", note: "test K" })
    await admin.admin.setUserTrial({ userId: t.id, days: 30 })
    const list = await names()
    expect(list).not.toContain(FAKE + "plan")
    expect(list).not.toContain(FAKE + "trial")
  })
})
