import { describe, it, expect, afterAll } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"
import { WITH_DELETED, softDeleteData } from "@/server/soft-delete"

function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_soft_delete"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_soft_delete (spec Q mục 12)", () => {
  it("chỉ ADD COLUMN có mặc định / cho phép null, không đụng dữ liệu, không index/unique", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME|INDEX|UNIQUE)\b/i)
    for (const t of ["payments", "students", "subjects", "teaching_sessions", "users"]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD COLUMN`))
    }
    expect(sql.match(/"is_deleted" BOOLEAN NOT NULL DEFAULT false/g)).toHaveLength(5)
    expect(sql.match(/"deleted_at" TIMESTAMP\(3\)/g)).toHaveLength(5)
    expect(sql).toMatch(/"deleted_by" VARCHAR\(50\)/)
  })
})

describe("Extension lọc bản đã xoá (spec Q Q1)", () => {
  let createdId: number | null = null

  afterAll(async () => {
    if (createdId) await db.student.deleteMany({ where: { id: createdId } })
  })

  it("đọc cấp cao bỏ bản đã xoá; isDeleted:true / WITH_DELETED đọc được; deleteMany vẫn xoá sạch", async () => {
    const userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
    const s = await db.student.create({ data: { userId, fullName: "SD-MIG An", grade: 5 } })
    createdId = s.id
    expect(s.isDeleted).toBe(false)

    await db.student.update({ where: { id: s.id }, data: softDeleteData() })

    expect(await db.student.findUnique({ where: { id: s.id } })).toBeNull()
    expect(await db.student.count({ where: { id: s.id } })).toBe(0)
    expect(await db.$transaction((tx) => tx.student.findFirst({ where: { id: s.id } }))).toBeNull()
    expect((await db.student.findUnique({ where: { id: s.id, isDeleted: true } }))?.id).toBe(s.id)
    expect((await db.student.findUnique({ where: { id: s.id, ...WITH_DELETED } }))?.id).toBe(s.id)

    const { count } = await db.student.deleteMany({ where: { id: s.id } })
    expect(count).toBe(1)
  })

  it("user seed có isDeleted false, deletedBy null", async () => {
    const u = await db.user.findUniqueOrThrow({
      where: { username: "teacher" },
      select: { isDeleted: true, deletedAt: true, deletedBy: true },
    })
    expect(u).toEqual({ isDeleted: false, deletedAt: null, deletedBy: null })
  })
})
