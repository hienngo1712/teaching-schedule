import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const D = "2031-05-15"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany({ where: { name: { not: "Tiếng Anh" } } })
}

async function defaultSubjectId(caller: Awaited<ReturnType<typeof getAuthedCaller>>) {
  const subjects = await caller.subject.list({})
  return subjects.find((s) => s.isDefault)!.id
}

describe("session.getMonth grades DTO (spec S5)", () => {
  beforeEach(clean)

  it("trả về danh sách grades phân biệt tăng dần, bỏ HS đã xoá, ca không HS trả []", async () => {
    const caller = await getAuthedCaller()
    const sid = await defaultSubjectId(caller)

    // Tạo 3 HS: lớp 4, lớp 5, lớp 5
    const st1 = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Lớp 4", grade: 4 })
    const st2 = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Lớp 5A", grade: 5 })
    const st3 = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Lớp 5B", grade: 5 })

    // Ca 1: có cả 3 HS
    const s1 = await caller.session.create({
      sessionDate: D,
      startTime: "08:00",
      endTime: "09:30",
      subjectId: sid,
      studentIds: [st1.id, st2.id, st3.id],
    })

    // Ca 2: không có HS
    const s2 = await caller.session.create({
      sessionDate: D,
      startTime: "10:00",
      endTime: "11:00",
      subjectId: sid,
      studentIds: [],
    })

    // Lấy danh sách ca trong tháng 5/2031
    let monthSessions = await caller.session.getMonth({ year: 2031, month: 5 })
    let foundS1 = monthSessions.find((s) => s.id === s1.id)
    const foundS2 = monthSessions.find((s) => s.id === s2.id)

    expect(foundS1).toBeDefined()
    expect(foundS1?.grades).toEqual([4, 5])

    expect(foundS2).toBeDefined()
    expect(foundS2?.grades).toEqual([])

    // Xoá mềm HS lớp 4 (deactivate rồi delete)
    await caller.student.deactivate({ id: st1.id })
    await caller.student.delete({ id: st1.id })

    monthSessions = await caller.session.getMonth({ year: 2031, month: 5 })
    foundS1 = monthSessions.find((s) => s.id === s1.id)
    expect(foundS1?.grades).toEqual([5])
  })
})
