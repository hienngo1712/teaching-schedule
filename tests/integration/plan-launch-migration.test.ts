import { describe, it, expect, afterEach } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

const PAIRS = `(4, 'qa_test'), (1, 'Suiuoi')`
const FAKE = "mig_fake_launch"

// Đọc đúng SQL sẽ chạy trên production, tách câu theo ";" (ghi chú trong file không chứa ";").
function launchStatements(pairs = PAIRS): string[] {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_launch_plan_grants"))
  expect(found).toHaveLength(1)
  const sql = readFileSync(join(dir, found[0], "migration.sql"), "utf8")
  expect(sql.split(PAIRS).length - 1).toBe(2)
  return sql
    .split(PAIRS)
    .join(pairs)
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
}

// 00:00 giờ VN của cùng ngày năm sau, dạng UTC (hôm nay không phải 29/2 nên không lệch).
function expectedExpiry(now: Date): Date {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return new Date(Date.UTC(vn.getUTCFullYear() + 1, vn.getUTCMonth(), vn.getUTCDate()) - 7 * 60 * 60 * 1000)
}

afterEach(async () => {
  await db.planOrder.deleteMany({ where: { user: { username: { startsWith: FAKE } } } })
  await db.user.deleteMany({ where: { username: { startsWith: FAKE } } })
})

describe("Migration launch_plan_grants", () => {
  it("SQL gốc trên DB test: 0 dòng (không có cặp id + username của production)", async () => {
    const counts = []
    for (const stmt of launchStatements()) counts.push(await db.$executeRawUnsafe(stmt))
    expect(counts).toEqual([0, 0])
  })

  it("user giả khớp cặp: Pro, hạn 00:00 VN năm sau (T17:00Z), 1 dòng plan_orders tặng", async () => {
    const u = await db.user.create({ data: { username: FAKE, passwordHash: "x" } })
    const before = new Date()
    for (const stmt of launchStatements(`(${u.id}, '${FAKE}')`)) await db.$executeRawUnsafe(stmt)

    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.plan).toBe("pro")
    expect(after.trialEndsAt).toBeNull()
    expect(after.planExpiresAt?.toISOString()).toBe(expectedExpiry(before).toISOString())
    expect(after.planExpiresAt?.toISOString()).toMatch(/T17:00:00\.000Z$/)

    const orders = await db.planOrder.findMany({ where: { userId: u.id } })
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      plan: "pro",
      amount: 0,
      status: "approved",
      source: "admin",
      decidedBy: "migration",
      note: "Tặng khi ra mắt phân gói",
      code: null,
      period: null,
      bonusMonths: 0,
      creditDays: 0,
    })
    expect(orders[0].grantedUntil?.toISOString()).toBe(after.planExpiresAt?.toISOString())
    // decided_at ghi giờ UTC: lệch hiện tại dưới 1 phút.
    expect(Math.abs(orders[0].decidedAt!.getTime() - before.getTime())).toBeLessThan(60_000)
  })

  it("đúng id nhưng sai username → 0 dòng", async () => {
    const u = await db.user.create({ data: { username: `${FAKE}_2`, passwordHash: "x" } })
    const counts = []
    for (const stmt of launchStatements(`(${u.id}, 'khong_khop')`)) counts.push(await db.$executeRawUnsafe(stmt))
    expect(counts).toEqual([0, 0])
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("standard")
  })

  it("seed test: teacher/teacher2 Pro 2099, teacher_std Standard không trial, admin_test có", async () => {
    const users = await db.user.findMany({
      where: { username: { in: ["teacher", "teacher2", "teacher_std", "admin_test"] } },
      orderBy: { username: "asc" },
      select: { username: true, plan: true, planExpiresAt: true, trialEndsAt: true },
    })
    expect(users.map((u) => [u.username, u.plan, u.planExpiresAt?.toISOString() ?? null, u.trialEndsAt])).toEqual([
      ["admin_test", "standard", null, null],
      ["teacher", "pro", "2099-12-31T17:00:00.000Z", null],
      ["teacher2", "pro", "2099-12-31T17:00:00.000Z", null],
      ["teacher_std", "standard", null, null],
    ])
  })
})
