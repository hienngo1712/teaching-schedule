import { describe, it, expect, beforeAll } from "vitest"
import { getAuthedCaller } from "../helpers/trpc"
type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

describe("Multi-tenant isolation", () => {
  let callerA: Caller
  let callerB: Caller
  let studentA: Awaited<ReturnType<Caller["student"]["create"]>>
  let sessionA: Awaited<ReturnType<Caller["session"]["create"]>>

  beforeAll(async () => {
    // Setup 2 users separately: teacher (userA) and teacher2 (userB)
    callerA = await getAuthedCaller("teacher")
    callerB = await getAuthedCaller("teacher2")

    // UserA creates data
    studentA = await callerA.student.create({ fullName: "HS của A", grade: 3 })
    
    // Get a subject ID for userA (subjects are seeded in setup.ts for teacher)
    const subjectsA = await callerA.subject.list({})
    const subjectIdA = subjectsA[0].id

    sessionA = await callerA.session.create({
      sessionDate: "2026-05-01", 
      startTime: "08:00", 
      endTime: "09:30",
      subjectId: subjectIdA
    })
  })

  // ── Student isolation ─────────────────────────────────────────
  it("UserB không thấy student của UserA", async () => {
    const students = await callerB.student.list({})
    const ids = students.items.map((s) => s.id)
    expect(ids).not.toContain(studentA.id)
  })

  it("UserB không thể update student của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.student.update({ id: studentA.id, data: { fullName: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("UserB không thể xóa student của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.student.delete({ id: studentA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Session isolation ─────────────────────────────────────────
  it("UserB không thấy session của UserA trong getMonth", async () => {
    const sessions = await callerB.session.getMonth({ year: 2026, month: 5 })
    const ids = sessions.map((s) => s.id)
    expect(ids).not.toContain(sessionA.id)
  })

  it("UserB không thể update session của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.session.update({ id: sessionA.id, data: { title: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("UserB không thể thêm student của UserA vào session của UserB → NOT_FOUND", async () => {
    // Get a subject ID for userB
    const subjectsB = await callerB.subject.list({})
    const subjectIdB = subjectsB[0].id

    const mySession = await callerB.session.create({
      sessionDate: "2026-05-02", 
      startTime: "08:00", 
      endTime: "09:30",
      subjectId: subjectIdB
    })
    
    // studentA thuộc userA → userB không được dùng
    await expect(
      callerB.session.addStudents({ sessionId: mySession.id, studentIds: [studentA.id] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Subject isolation ─────────────────────────────────────────
  it("UserB không thấy subject của UserA", async () => {
    const subjectsA = await callerA.subject.list({})
    const subjectsB = await callerB.subject.list({})
    const idsA = subjectsA.map((s) => s.id)
    const idsB = subjectsB.map((s) => s.id)
    // Check if there is any intersection
    const intersection = idsA.filter((id: number) => idsB.includes(id))
    expect(intersection).toHaveLength(0)
  })

  it("UserB không thể update subject của UserA → NOT_FOUND", async () => {
    const subjectsA = await callerA.subject.list({})
    const subjectA = subjectsA[0]
    await expect(
      callerB.subject.update({ id: subjectA.id, data: { name: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Attendance isolation ──────────────────────────────────────
  it("UserB không thể lấy attendance của session UserA → NOT_FOUND", async () => {
    await expect(
      callerB.attendance.get({ sessionId: sessionA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("UserB không thể update attendance của session UserA → NOT_FOUND", async () => {
    await expect(
      callerB.attendance.update({ sessionId: sessionA.id, attendances: [] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Report isolation ──────────────────────────────────────────
  it("UserB không thể xem report student của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.report.student({ studentId: studentA.id, year: 2026, month: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("report.monthlySummary chỉ trả data của user đó", async () => {
    const summaryA = await callerA.report.monthlySummary({ year: 2026, month: 5 })
    const summaryB = await callerB.report.monthlySummary({ year: 2026, month: 5 })

    // Each user only sees their own session in the summary
    expect(summaryA.totalSessions).toBe(1)
    expect(summaryB.totalSessions).toBe(1)

    // student.list is paginated ({ items }) and isolated per user
    const studentsA = await callerA.student.list({})
    const studentsB = await callerB.student.list({})
    expect(studentsA.items.map((s) => s.id)).toContain(studentA.id)
    expect(studentsB.items.map((s) => s.id)).not.toContain(studentA.id)
  })
})
