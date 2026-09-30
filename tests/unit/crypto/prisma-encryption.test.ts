import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import {
  ENCRYPTED_FIELDS,
  ENCRYPTED_KEYS,
  EncryptedFieldQueryError,
  assertNoEncryptedFilter,
  decryptResult,
  encryptWriteArgs,
} from "@/server/crypto/prisma-encryption"
import { FieldCryptoConfigError, decryptField, isEncrypted } from "@/server/crypto/field-crypto"

const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEYS = `u1:${randomBytes(32).toString("base64")}`
  process.env.DATA_ENCRYPTION_ACTIVE_KID = "u1"
})
afterAll(() => {
  process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
  process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
})

describe("encryptWriteArgs (spec O 6.3)", () => {
  it("create: mã hoá trường thuộc tập, giữ nguyên trường khác, không sửa object gốc", () => {
    const args = { data: { userId: 1, fullName: "An", grade: 3, parentPhone: null, notes: undefined } }
    const out = encryptWriteArgs(args)
    expect(args.data.fullName).toBe("An")
    expect(isEncrypted(out.data.fullName)).toBe(true)
    expect(decryptField(out.data.fullName as string, "fullName")).toBe("An")
    expect(out.data.grade).toBe(3)
    expect(out.data.parentPhone).toBeNull()
    expect(out.data.notes).toBeUndefined()
  })

  it("createMany mảng, update { set }, upsert create+update, ghi lồng", () => {
    const many = encryptWriteArgs({ data: [{ fullName: "A" }, { fullName: "B" }] })
    expect(many.data.every((r) => isEncrypted(r.fullName))).toBe(true)
    const set = encryptWriteArgs({ where: { id: 1 }, data: { note: { set: "x" } } })
    expect(isEncrypted(set.data.note.set)).toBe(true)
    const up = encryptWriteArgs({ where: { id: 1 }, create: { notes: "c" }, update: { notes: "u" } })
    expect(isEncrypted(up.create.notes) && isEncrypted(up.update.notes)).toBe(true)
    const nested = encryptWriteArgs({ data: { notes: "ca", sessionStudents: { create: [{ studentId: 1, note: "vắng" }] } } })
    expect(isEncrypted(nested.data.sessionStudents.create[0].note)).toBe(true)
    const when = new Date("2026-01-01T00:00:00Z")
    expect(encryptWriteArgs({ data: { createdAt: when } }).data.createdAt).toBe(when)
  })

  it("thiếu khoá → ném FieldCryptoConfigError, không trả bản rõ", () => {
    delete process.env.DATA_ENCRYPTION_KEYS
    expect(() => encryptWriteArgs({ data: { fullName: "An" } })).toThrow(FieldCryptoConfigError)
  })
})

describe("decryptResult", () => {
  it("giải mã lồng nhiều cấp, mảng, bỏ qua bản rõ cũ và khoá khác", () => {
    const enc = encryptWriteArgs({ data: { fullName: "Bình", note: "ốm" } }).data
    const out = decryptResult({
      id: 1,
      title: enc.fullName,
      sessionStudents: [{ note: enc.note, student: { fullName: enc.fullName, grade: 3 } }],
      user: { fullName: "Bản rõ cũ" },
      _count: { sessionStudents: 1 },
    })
    expect(out.sessionStudents[0].note).toBe("ốm")
    expect(out.sessionStudents[0].student.fullName).toBe("Bình")
    expect(out.user.fullName).toBe("Bản rõ cũ")
    // `title` không thuộc tập → không giải mã.
    expect(isEncrypted(out.title)).toBe(true)
  })
})

describe("assertNoEncryptedFilter", () => {
  const bad = [
    { where: { fullName: { contains: "a" } } },
    { orderBy: [{ grade: "asc" }, { fullName: "asc" }] },
    { include: { sessionStudents: { orderBy: { student: { fullName: "asc" } } } } },
    { where: { sessionStudents: { some: { student: { fullName: "x" } } } } },
    { where: { AND: [{ userId: 1 }, { notes: { not: null } }] } },
    { distinct: ["fullName"] },
    { by: ["parentPhone"] },
    { where: { parentLinkToken: "t" } },
  ]
  it.each(bad.map((a) => [JSON.stringify(a), a]))("ném với %s", (_label, args) => {
    expect(() => assertNoEncryptedFilter(args)).toThrow(EncryptedFieldQueryError)
  })

  it("không ném với lọc trường thường, select trường mã hoá, giá trị chuỗi trùng tên khoá", () => {
    for (const args of [
      { where: { userId: 1, isActive: true }, orderBy: { id: "asc" } },
      { select: { fullName: true, notes: true } },
      { where: { username: "notes" } },
      { where: { parentLinkTokenHash: "abc" } },
      undefined,
    ]) {
      expect(() => assertNoEncryptedFilter(args)).not.toThrow()
    }
  })
})

describe("ENCRYPTED_FIELDS khớp schema (DMMF)", () => {
  it("mọi trường String trùng tên khoá mã hoá đều được khai báo; trường khai báo tồn tại và không còn VarChar", () => {
    const declaredOf = (m: string) => (ENCRYPTED_FIELDS as Record<string, readonly string[]>)[m] ?? []
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const f of model.fields) {
        if (f.kind !== "scalar" || f.type !== "String") continue
        if (ENCRYPTED_KEYS.has(f.name)) expect(declaredOf(model.name), `${model.name}.${f.name}`).toContain(f.name)
        if (declaredOf(model.name).includes(f.name)) {
          expect((f as unknown as { nativeType?: string[] }).nativeType?.[0], `${model.name}.${f.name} phải là TEXT`).not.toBe("VarChar")
        }
      }
    }
    for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
      expect(m, model).toBeDefined()
      for (const f of fields) expect(m!.fields.some((x) => x.name === f), `${model}.${f}`).toBe(true)
    }
  })
})
