import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_user_activity"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_user_activity", () => {
  it("chỉ thêm cột/bảng/index/FK CASCADE + backfill vào cột mới", () => {
    const sql = migrationSql()
    expect(sql.replace(/ON DELETE CASCADE/gi, "")).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i)
    expect(sql).toMatch(/ADD COLUMN\s+"last_active_at" TIMESTAMP\(3\)/)
    expect(sql).toMatch(/ADD COLUMN\s+"admin_seen_at" TIMESTAMP\(3\)/)
    expect(sql).toContain('CREATE TABLE "user_activity_days"')
    expect(sql).toMatch(/ON DELETE CASCADE/)
    const updates = sql.match(/^UPDATE .*$/gim) ?? []
    expect(updates).toEqual([
      'UPDATE "users" SET "last_active_at" = "last_login_at" WHERE "last_active_at" IS NULL;',
      `UPDATE "users" SET "admin_seen_at" = now() AT TIME ZONE 'UTC' WHERE "admin_seen_at" IS NULL;`,
    ])
  })

  it("DB test đã áp: đọc được 2 cột và bảng mới", async () => {
    await expect(db.user.findFirst({ select: { lastActiveAt: true, adminSeenAt: true } })).resolves.toBeDefined()
    await expect(db.userActivityDay.count()).resolves.toBeGreaterThanOrEqual(0)
  })
})
