import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("Active/inactive student consistency", () => {
  beforeEach(async () => {
    await cleanup()
  })

  // ── Reports: header count must tie out with the session-based body ──
  it("monthlySummary.totalStudents counts students taught in the period, including graduated", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const s = await caller.student.create({ fullName: "HS Tốt Nghiệp", grade: 9, tuitionFee: 0 })
    await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30",
      subjectId, studentIds: [s.id],
    })
    // Student graduates / drops out after attending the May session
    await caller.student.update({ id: s.id, data: { isActive: false } })

    const summary = await caller.report.monthlySummary({ year: 2026, month: 5 })

    // The student had a session in May, so the report headcount must include
    // them — matching revenue, which is session-snapshot based.
    expect(summary.totalStudents).toBe(1)

    // Same invariant seen through the grade filter (the surface the reports page
    // actually uses): the graduated student still counts under the grade they
    // attended as.
    const grade9 = await caller.report.monthlySummary({ year: 2026, month: 5, grade: 9 })
    expect(grade9.totalStudents).toBe(1)
  }, 30_000)

  // ── Students page: must be able to view inactive (graduated) students ──
  it("student.list defaults to active-only", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "Đang Học A", grade: 3 })
    const b = await caller.student.create({ fullName: "Đã Nghỉ B", grade: 3 })
    await caller.student.update({ id: b.id, data: { isActive: false } })

    const res = await caller.student.list({})
    const ids = res.items.map((x) => x.id)
    expect(ids).toContain(a.id)
    expect(ids).not.toContain(b.id)
  })

  it("student.list isActive:false returns only inactive students", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "Đang Học A", grade: 3 })
    const b = await caller.student.create({ fullName: "Đã Nghỉ B", grade: 3 })
    await caller.student.update({ id: b.id, data: { isActive: false } })

    const res = await caller.student.list({ isActive: false })
    const ids = res.items.map((x) => x.id)
    expect(ids).toContain(b.id)
    expect(ids).not.toContain(a.id)
  })

  it("student.list includeInactive returns both active and inactive", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "Đang Học A", grade: 3 })
    const b = await caller.student.create({ fullName: "Đã Nghỉ B", grade: 3 })
    await caller.student.update({ id: b.id, data: { isActive: false } })

    const res = await caller.student.list({ includeInactive: true })
    const ids = res.items.map((x) => x.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
  })
})
