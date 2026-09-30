import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { CONSENT_ACCEPTED, CONSENT_TEXT_VERSION } from "@/lib/consent"
import { publicCaller } from "../helpers/trpc"

async function cleanup() {
  const users = await db.user.findMany({ where: { username: { startsWith: "dk_consent_" } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  if (userIds.length > 0) {
    await db.subject.deleteMany({ where: { userId: { in: userIds } } })
    await db.student.deleteMany({ where: { userId: { in: userIds } } })
    await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } })
    await db.securityEvent.deleteMany({ where: { userId: { in: userIds } } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  }
  await db.student.deleteMany()
  await db.consentRecord.deleteMany()
  await db.securityEvent.deleteMany()
  await db.user.updateMany({ data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } })
}
beforeEach(cleanup)
afterAll(cleanup)

const BANK = { bankBin: "970436", bankAccountNumber: "0011001234567", bankAccountName: "NGUYEN VAN A" }

describe("Đồng ý chia sẻ dữ liệu phía server (spec O 6.6)", () => {
  it("auth.register thiếu key đồng ý → BAD_REQUEST, không tạo user; có key → 1 bằng chứng scope register", async () => {
    // @ts-expect-error gọi như client cũ không gửi key
    await expect(publicCaller.auth.register({ username: "dk_consent_a", password: "MatKhau2026x", fullName: "A" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.user.count({ where: { username: "dk_consent_a" } })).toBe(0)
    await publicCaller.auth.register({ consent: CONSENT_ACCEPTED, username: "dk_consent_b", password: "MatKhau2026x", fullName: "B" })
    const u = await db.user.findUniqueOrThrow({ where: { username: "dk_consent_b" } })
    expect(await db.consentRecord.findFirstOrThrow({ where: { userId: u.id } })).toMatchObject({ scope: "register", textVersion: CONSENT_TEXT_VERSION })
  })

  it("key đồng ý mang version cũ (tab chưa tải lại) → BAD_REQUEST", async () => {
    const t = await getAuthedCaller()
    await expect(t.student.create({ consent: { accepted: true, version: "2000-01-v0" }, fullName: "Tab Cũ", grade: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("student.create thiếu consent → BAD_REQUEST, không ghi HS, không ghi bằng chứng", async () => {
    const t = await getAuthedCaller()
    // @ts-expect-error gọi như client cũ không gửi cờ
    await expect(t.student.create({ fullName: "Không Đồng Ý", grade: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.student.count()).toBe(0)
    expect(await db.consentRecord.count()).toBe(0)
  })

  it("student.create có consent → 1 bằng chứng scope student, đúng version, userId", async () => {
    const t = await getAuthedCaller()
    await t.student.create({ consent: CONSENT_ACCEPTED, fullName: "Có Đồng Ý", grade: 3 })
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const rows = await db.consentRecord.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: teacher.id, scope: "student", textVersion: CONSENT_TEXT_VERSION, studentId: null, itemCount: 1 })
  })

  it("student.update: sửa tên thiếu consent → CONSENT_REQUIRED, tên giữ nguyên; chỉ đổi isActive không cần", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ consent: CONSENT_ACCEPTED, fullName: "Tên Cũ", grade: 3 })
    await expect(t.student.update({ id: s.id, data: { fullName: "Tên Mới" } })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "CONSENT_REQUIRED" })
    expect((await t.student.list({})).items[0].fullName).toBe("Tên Cũ")
    await t.student.update({ id: s.id, data: { isActive: false } })
    expect(await db.consentRecord.count()).toBe(1)
    await t.student.update({ id: s.id, data: { fullName: "Tên Mới" }, consent: CONSENT_ACCEPTED })
    const last = await db.consentRecord.findFirstOrThrow({ orderBy: { id: "desc" } })
    expect(last).toMatchObject({ scope: "student", studentId: s.id })
  })

  it("student.importMany: thiếu consent bị từ chối; có consent ghi itemCount = số dòng", async () => {
    const t = await getAuthedCaller()
    const rows = [{ fullName: "Nhập A", grade: 3, tuitionFee: 0 }, { fullName: "Nhập B", grade: 4, tuitionFee: 0 }]
    // @ts-expect-error thiếu cờ
    await expect(t.student.importMany({ rows })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.student.count()).toBe(0)
    await t.student.importMany({ rows, consent: CONSENT_ACCEPTED })
    expect(await db.consentRecord.findFirstOrThrow()).toMatchObject({ scope: "student_import", itemCount: 2 })
  })

  it("settings.updateBankAccount: thiếu consent bị từ chối; có consent ghi bằng chứng + sự kiện; xoá (null) không cần", async () => {
    const t = await getAuthedCaller()
    // @ts-expect-error thiếu cờ
    await expect(t.settings.updateBankAccount(BANK)).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await t.settings.getBankAccount()).toBeNull()
    await t.settings.updateBankAccount({ ...BANK, consent: CONSENT_ACCEPTED })
    expect(await t.settings.getBankAccount()).toEqual(BANK)
    expect(await db.consentRecord.findFirstOrThrow()).toMatchObject({ scope: "bank_account" })
    await t.settings.updateBankAccount(null)
    expect(await t.settings.getBankAccount()).toBeNull()
    const events = await db.securityEvent.findMany({ orderBy: { id: "asc" } })
    expect(events.map((e) => e.event)).toEqual(["bank_account_update", "bank_account_clear"])
    expect(await db.consentRecord.count()).toBe(1)
  })
})
