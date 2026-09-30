import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { db } from "@/server/db"
import { ENCRYPTED_FIELDS } from "@/server/crypto/prisma-encryption"
import { FIELD_TARGETS, runBackfill, type FieldReport } from "@/server/crypto/backfill"
import { readKid } from "@/server/crypto/field-crypto"
import { hashParentToken } from "@/server/crypto/parent-token"
import { getParentView } from "@/server/services/parent-link.service"

// Client THƯỜNG (không extension) để ghi bản rõ như dữ liệu trước O và đọc ciphertext thô.
const raw = new PrismaClient()
const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
const TOKEN = "T".repeat(43)

async function cleanup() {
  await raw.sessionStudent.deleteMany()
  await raw.teachingSession.deleteMany()
  await raw.student.deleteMany()
}
beforeEach(async () => {
  process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
  process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
  await cleanup()
})
afterAll(async () => {
  process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
  process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
  await cleanup()
  await raw.$disconnect()
})

const col = (reports: FieldReport[], table: string, column: string) =>
  reports.find((r) => r.table === table && r.column === column)!

async function seedPlain() {
  const teacher = await raw.user.findUniqueOrThrow({ where: { username: "teacher" } })
  const s = await raw.student.create({
    data: { userId: teacher.id, fullName: "Bản Rõ Một", grade: 3, parentPhone: "0901111222", notes: "ghi chú rõ", parentLinkToken: TOKEN, parentLinkTokenHash: hashParentToken(TOKEN) },
  })
  const deleted = await raw.student.create({ data: { userId: teacher.id, fullName: "Đã Xoá Mềm", grade: 4 } })
  // Thùng rác của Q cũng phải được mã hoá (spec O 6.13 ý 1). Đổi tên cột theo schema thật của Q.
  const cols = await raw.$queryRaw<Array<{ c: string }>>`SELECT column_name AS c FROM information_schema.columns WHERE table_name = 'students' AND column_name IN ('deleted_at','is_deleted')`
  if (cols.some((x) => x.c === "deleted_at")) await raw.$executeRawUnsafe(`UPDATE "students" SET "deleted_at" = now() WHERE id = $1`, deleted.id)
  if (cols.some((x) => x.c === "is_deleted")) await raw.$executeRawUnsafe(`UPDATE "students" SET "is_deleted" = true WHERE id = $1`, deleted.id)
  return { s, deleted }
}

async function rawStudent(id: number) {
  const [r] = await raw.$queryRaw<Array<{ fn: string; ph: string | null; nt: string | null; tok: string | null; up: Date }>>`
    SELECT full_name AS fn, parent_phone AS ph, notes AS nt, parent_link_token AS tok, updated_at AS up FROM students WHERE id = ${id}`
  return r
}

describe("Backfill mã hoá dữ liệu cũ (spec O 6.11)", () => {
  it("FIELD_TARGETS phủ đúng ENCRYPTED_FIELDS, mỗi cặp 1 lần", () => {
    const want = Object.entries(ENCRYPTED_FIELDS).flatMap(([m, fs]) => fs.map((f) => `${m}.${f}`)).sort()
    expect(FIELD_TARGETS.map((t) => `${t.model}.${t.field}`).sort()).toEqual(want)
  })

  it("dry-run không ghi; apply mã hoá cả dòng xoá mềm, giữ updated_at, checksum không đổi; apply lần 2 changed = 0; verify sạch", async () => {
    const { s, deleted } = await seedPlain()
    const before = await rawStudent(s.id)
    const dry = await runBackfill(raw, "dry-run")
    expect(col(dry, "students", "full_name").plain).toBeGreaterThanOrEqual(2)
    expect(dry.every((r) => r.changed === 0)).toBe(true)
    expect((await rawStudent(s.id)).fn).toBe("Bản Rõ Một")

    const applied = await runBackfill(raw, "apply")
    const after = await rawStudent(s.id)
    for (const v of [after.fn, after.ph, after.nt, after.tok]) expect(v?.startsWith("enc:v1:")).toBe(true)
    expect((await rawStudent(deleted.id)).fn.startsWith("enc:v1:")).toBe(true)
    expect(after.up.getTime()).toBe(before.up.getTime())
    for (const r of applied) {
      expect(r.checksum, `${r.table}.${r.column}`).toBe(col(dry, r.table, r.column).checksum)
      expect(r.plain).toBe(0)
    }

    const again = await runBackfill(raw, "apply")
    expect(again.every((r) => r.changed === 0)).toBe(true)
    const verify = await runBackfill(raw, "verify")
    expect(verify.every((r) => r.plain === 0 && r.undecryptable === 0)).toBe(true)

    // App (qua extension) vẫn đọc đúng; link phụ huynh cũ vẫn mở được.
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).fullName).toBe("Bản Rõ Một")
    expect((await getParentView(db, TOKEN))?.student.fullName).toBe("Bản Rõ Một")
  })

  it("rotate sang khoá mới; decrypt đưa về bản rõ; checksum giữ nguyên", async () => {
    const { s } = await seedPlain()
    const dry = await runBackfill(raw, "dry-run")
    await runBackfill(raw, "apply")
    const oldKid = readKid((await rawStudent(s.id)).fn)
    process.env.DATA_ENCRYPTION_KEYS = `${ORIGINAL.keys},r2:${randomBytes(32).toString("base64")}`
    process.env.DATA_ENCRYPTION_ACTIVE_KID = "r2"
    const rotated = await runBackfill(raw, "rotate")
    expect(readKid((await rawStudent(s.id)).fn)).toBe("r2")
    expect(col(rotated, "students", "full_name").encrypted[oldKid!] ?? 0).toBe(0)
    const back = await runBackfill(raw, "decrypt")
    expect((await rawStudent(s.id)).fn).toBe("Bản Rõ Một")
    for (const r of back) expect(r.checksum).toBe(col(dry, r.table, r.column).checksum)
  })

  it("chuỗi giả tiền tố enc:v1: không giải mã được → undecryptable, không bị ghi", async () => {
    const { s } = await seedPlain()
    await raw.$executeRaw`UPDATE students SET notes = 'enc:v1:t1:hong:hong:hong' WHERE id = ${s.id}`
    const lines: string[] = []
    const rep = await runBackfill(raw, "apply", { log: (l) => lines.push(l) })
    expect(col(rep, "students", "notes").undecryptable).toBe(1)
    expect((await rawStudent(s.id)).nt).toBe("enc:v1:t1:hong:hong:hong")
    expect(lines.join("\n")).toContain(`students.notes id=${s.id}`)
    expect(lines.join("\n")).not.toContain("hong:hong")
  })
})
