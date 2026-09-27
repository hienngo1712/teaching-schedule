import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_plan_settings"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_plan_settings", () => {
  it("chỉ tạo bảng/index và seed, không đụng bảng cũ", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|ALTER|TRUNCATE|DELETE|UPDATE)\b/i)
    expect(sql).toContain('CREATE TABLE "plan_price_changes"')
    expect(sql).toContain('CREATE TABLE "trial_day_changes"')
    expect(sql).toMatch(/\('plus',\s*49000,\s*NULL,\s*'migration'/)
    expect(sql).toMatch(/\('pro',\s*99000,\s*NULL,\s*'migration'/)
    expect(sql).toMatch(/\(NULL,\s*60,\s*NULL,\s*'migration'/)
  })

  it("DB test đã áp: đúng 2 dòng giá seed và 1 dòng dùng thử mặc định seed", async () => {
    const prices = await db.planPriceChange.findMany({
      where: { changedBy: "migration" },
      orderBy: { plan: "asc" },
      select: { plan: true, monthPrice: true, previousMonthPrice: true },
    })
    expect(prices).toEqual([
      { plan: "plus", monthPrice: 49000, previousMonthPrice: null },
      { plan: "pro", monthPrice: 99000, previousMonthPrice: null },
    ])
    const trial = await db.trialDayChange.findMany({
      where: { changedBy: "migration" },
      select: { userId: true, days: true, previousDays: true },
    })
    expect(trial).toEqual([{ userId: null, days: 60, previousDays: null }])
  })
})
