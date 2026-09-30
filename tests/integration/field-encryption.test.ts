import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { EncryptedFieldQueryError } from "@/server/crypto/prisma-encryption"

async function cleanup() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } })
}
beforeEach(cleanup)
afterAll(cleanup)

// Alias cột để $queryRaw qua `db` không bị decryptResult giải mã (tên cột trùng khoá như "notes").
type RawStudent = { fn: string; ph: string | null; pn: string | null; nt: string | null }

describe("Mã hoá trường cá nhân qua db (spec O 6.3)", () => {
  it("tạo HS qua caller: cột trong DB là ciphertext, đọc qua caller ra bản rõ", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ consent: CONSENT_ACCEPTED,  fullName: "Nguyễn Thị Mai", grade: 4, parentPhone: "0901234567", parentName: "Nguyễn Văn Hùng", notes: "Dị ứng sữa" })
    const [raw] = await db.$queryRaw<RawStudent[]>`
      SELECT full_name AS fn, parent_phone AS ph, parent_name AS pn, notes AS nt FROM students WHERE id = ${s.id}`
    for (const [v, plain] of [[raw.fn, "Nguyễn Thị Mai"], [raw.ph, "0901234567"], [raw.pn, "Nguyễn Văn Hùng"], [raw.nt, "Dị ứng sữa"]] as const) {
      expect(v?.startsWith("enc:v1:")).toBe(true)
      expect(v).not.toContain(plain)
    }
    const list = await t.student.list({ search: "mai" })
    expect(list.items[0]).toMatchObject({ fullName: "Nguyễn Thị Mai", parentPhone: "0901234567", parentName: "Nguyễn Văn Hùng", notes: "Dị ứng sữa" })
  })

  it("tài khoản ngân hàng: DB ciphertext, getBankAccount ra bản rõ", async () => {
    const t = await getAuthedCaller()
    const bank = { bankBin: "970436", bankAccountNumber: "0011001234567", bankAccountName: "NGUYEN VAN A" }
    await t.settings.updateBankAccount({ ...bank, consent: CONSENT_ACCEPTED })
    const [raw] = await db.$queryRaw<Array<{ n: string; a: string; b: string }>>`
      SELECT bank_account_number AS n, bank_account_name AS a, bank_bin AS b FROM users WHERE username = 'teacher'`
    expect(raw.n.startsWith("enc:v1:") && raw.a.startsWith("enc:v1:")).toBe(true)
    expect(raw.b).toBe("970436")
    expect(await t.settings.getBankAccount()).toEqual(bank)
  })

  it("ghi lồng: ca kèm sessionStudents có note → cả 2 cột ciphertext; include lồng giải mã", async () => {
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const subject = await db.subject.findFirstOrThrow({ where: { userId: teacher.id } })
    const st = await db.student.create({ data: { userId: teacher.id, fullName: "Phạm Quang", grade: 6 } })
    const ses = await db.teachingSession.create({
      data: {
        userId: teacher.id, subjectId: subject.id, notes: "Ôn thi",
        sessionDate: new Date("2026-03-02T00:00:00Z"),
        startTime: new Date("1970-01-01T08:00:00Z"), endTime: new Date("1970-01-01T09:00:00Z"),
        sessionStudents: { create: [{ studentId: st.id, grade: 6, fee: 0, note: "Vắng vì ốm" }] },
      },
      include: { sessionStudents: { include: { student: true } } },
    })
    expect(ses.notes).toBe("Ôn thi")
    expect(ses.sessionStudents[0].note).toBe("Vắng vì ốm")
    expect(ses.sessionStudents[0].student.fullName).toBe("Phạm Quang")
    const [raw] = await db.$queryRaw<Array<{ sn: string; nn: string }>>`
      SELECT ts.notes AS sn, ss.note AS nn FROM teaching_sessions ts JOIN session_students ss ON ss.session_id = ts.id WHERE ts.id = ${ses.id}`
    expect(raw.sn.startsWith("enc:v1:") && raw.nn.startsWith("enc:v1:")).toBe(true)
  })

  it("bản rõ cũ (trước O2) vẫn đọc và tìm được", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ consent: CONSENT_ACCEPTED,  fullName: "Tạm", grade: 2 })
    await db.$executeRaw`UPDATE students SET full_name = 'Hoàng Bản Rõ', notes = 'ghi chú cũ' WHERE id = ${s.id}`
    const list = await t.student.list({ search: "bản rõ" })
    expect(list.items.map((x) => [x.fullName, x.notes])).toEqual([["Hoàng Bản Rõ", "ghi chú cũ"]])
  })

  it("lọc DB theo trường mã hoá → EncryptedFieldQueryError; transaction thừa hưởng extension", async () => {
    await expect(db.student.findMany({ where: { fullName: "x" } })).rejects.toBeInstanceOf(EncryptedFieldQueryError)
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const id = await db.$transaction(async (tx) => (await tx.student.create({ data: { userId: teacher.id, fullName: "Trong Tx", grade: 1 } })).id)
    const [raw] = await db.$queryRaw<Array<{ fn: string }>>`SELECT full_name AS fn FROM students WHERE id = ${id}`
    expect(raw.fn.startsWith("enc:v1:")).toBe(true)
  })
})
