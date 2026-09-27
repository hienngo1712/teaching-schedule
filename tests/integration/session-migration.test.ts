import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_session_version_password_reset"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_session_version_password_reset (spec N mục 9, R2, R3)", () => {
  it("chỉ thêm cột có mặc định + tạo bảng/index, không đụng dữ liệu cũ", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME)\b/i)
    for (const stmt of sql.match(/ALTER TABLE[^;]*/g) ?? []) {
      expect(stmt).toMatch(/^ALTER TABLE "users" ADD COLUMN/)
    }
    expect(sql).toMatch(/"session_version" INTEGER NOT NULL DEFAULT 0/)
    expect(sql).toMatch(/"must_change_password" BOOLEAN NOT NULL DEFAULT false/)
    expect(sql).toContain('CREATE TABLE "password_reset_logs"')
  })

  it("DB test đã áp: user seed có sessionVersion 0, mustChangePassword false; bảng log đọc được", async () => {
    const t = await db.user.findUniqueOrThrow({
      where: { username: "teacher" },
      select: { sessionVersion: true, mustChangePassword: true },
    })
    expect(t).toEqual({ sessionVersion: 0, mustChangePassword: false })
    expect(await db.passwordResetLog.count()).toBeGreaterThanOrEqual(0)
  })
})
