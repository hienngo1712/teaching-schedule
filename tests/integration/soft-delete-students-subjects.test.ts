import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const FUTURE = "2031-03-03"

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("Học sinh: xoá mềm vs cho nghỉ (spec Q mục 5)", () => {
  let subjectId: number
  beforeAll(async () => {
    await clean()
    await db.subject.deleteMany()
    subjectId = (await (await getAuthedCaller()).subject.create({ name: "Toán", color: "#0891B2" })).id
  })
  beforeEach(clean)

  it("xoá: chỉ isDeleted/deletedAt, isActive + link ca + token giữ; biến khỏi danh sách kể cả 'Tất cả'", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    await caller.session.create({ sessionDate: FUTURE, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id] })
    await db.student.update({ where: { id: a.id }, data: { parentLinkToken: "t".repeat(43) } })

    await caller.student.delete({ id: a.id })

    const row = await db.student.findUniqueOrThrow({ where: { id: a.id, isDeleted: true } })
    expect(row.isActive).toBe(true)
    expect(row.deletedAt).toBeInstanceOf(Date)
    expect(row.parentLinkToken).toBe("t".repeat(43))
    expect(await db.sessionStudent.count({ where: { studentId: a.id } })).toBe(1)
    expect((await caller.student.list({ includeInactive: true })).items.map((s) => s.id)).not.toContain(a.id)
    await expect(caller.student.update({ consent: CONSENT_ACCEPTED,  id: a.id, data: { fullName: "HS X" } })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.student.delete({ id: a.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.session.create({ sessionDate: FUTURE, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [a.id] }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("nhập Excel: HS đã xoá không bị coi là trùng", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    await caller.student.delete({ id: a.id })
    const { matches } = await caller.student.importCheck({ rows: [{ fullName: "HS An", grade: 5 }] })
    expect(matches).toEqual([null])
  })

  it("cho nghỉ (deactivate): isActive=false, gỡ khỏi ca chưa dạy, vẫn ở lọc Đã nghỉ", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    await caller.session.create({ sessionDate: FUTURE, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [a.id] })
    await caller.student.deactivate({ id: a.id })
    expect((await db.student.findUniqueOrThrow({ where: { id: a.id } })).isActive).toBe(false)
    expect(await db.sessionStudent.count({ where: { studentId: a.id } })).toBe(0)
    expect((await caller.student.list({ isActive: false })).items.map((s) => s.id)).toContain(a.id)
  })

  it("nâng lớp không đụng HS đã xoá", async () => {
    const caller = await getAuthedCaller()
    const userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
    await db.classUpgradeLog.deleteMany({ where: { userId } })
    const a = await caller.student.create({ consent: CONSENT_ACCEPTED,  fullName: "HS An", grade: 5 })
    await caller.student.delete({ id: a.id })
    await caller.student.upgradeAllClasses()
    expect((await db.student.findUniqueOrThrow({ where: { id: a.id, isDeleted: true } })).grade).toBe(5)
    await db.classUpgradeLog.deleteMany({ where: { userId } })
  })
})

describe("Môn học xoá mềm (spec Q X6, Q2)", () => {
  beforeEach(async () => {
    await clean()
    await db.subject.deleteMany({ where: { name: { not: "Tiếng Anh" } } })
    const caller = await getAuthedCaller()
    const list = await caller.subject.list({})
    if (!list.some((s) => s.name === "Tiếng Anh")) {
      await caller.subject.create({ name: "Tiếng Anh", color: "#4F46E5", isDefault: true })
    }
  })

  it("chặn môn mặc định, môn còn ca; ca đã xoá không chặn", async () => {
    const caller = await getAuthedCaller()
    const def = (await caller.subject.list({})).find((s) => s.isDefault)!
    await expect(caller.subject.delete({ id: def.id })).rejects.toMatchObject({ code: "BAD_REQUEST" })

    const m = await caller.subject.create({ name: "Lý", color: "#D97706" })
    const s = await caller.session.create({ sessionDate: FUTURE, startTime: "08:00", endTime: "09:00", subjectId: m.id })
    await expect(caller.subject.delete({ id: m.id })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await caller.session.delete({ id: s.id })
    await caller.subject.delete({ id: m.id })

    expect(await db.subject.findUnique({ where: { id: m.id, isDeleted: true } })).not.toBeNull()
    expect((await caller.subject.list({})).map((x) => x.id)).not.toContain(m.id)
    await expect(caller.session.create({ sessionDate: FUTURE, startTime: "10:00", endTime: "11:00", subjectId: m.id }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("tạo / đổi tên trùng môn trong thùng rác → câu Thùng rác", async () => {
    const caller = await getAuthedCaller()
    const m = await caller.subject.create({ name: "Hoá", color: "#DC2626" })
    await caller.subject.delete({ id: m.id })
    await expect(caller.subject.create({ name: "Hoá", color: "#DC2626" })).rejects.toThrow(/Thùng rác/)
    const other = await caller.subject.create({ name: "Sinh", color: "#16A34A" })
    await expect(caller.subject.update({ id: other.id, data: { name: "Hoá" } })).rejects.toThrow(/Thùng rác/)
  })
})
