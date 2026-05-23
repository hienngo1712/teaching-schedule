import { describe, expect, it, beforeEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetUserData(username: string) {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) return
  await db.classUpgradeLog.deleteMany({ where: { userId: user.id } })
  await db.sessionStudent.deleteMany({
    where: { student: { userId: user.id } },
  })
  await db.teachingSession.deleteMany({ where: { userId: user.id } })
  await db.student.deleteMany({ where: { userId: user.id } })
}

describe("student.upgradeAllClasses — manual", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    vi.useRealTimers()
  })

  it("upgrades grade 1-8 active students by +1", async () => {
    const caller = await getAuthedCaller("teacher")
    const s1 = await caller.student.create({ fullName: "HS Lop 1", grade: 1, tuitionFee: 0, isActive: true })
    const s5 = await caller.student.create({ fullName: "HS Lop 5", grade: 5, tuitionFee: 0, isActive: true })
    const s8 = await caller.student.create({ fullName: "HS Lop 8", grade: 8, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after1 = await db.student.findUnique({ where: { id: s1.id } })
    const after5 = await db.student.findUnique({ where: { id: s5.id } })
    const after8 = await db.student.findUnique({ where: { id: s8.id } })

    expect(after1?.grade).toBe(2)
    expect(after5?.grade).toBe(6)
    expect(after8?.grade).toBe(9)
    expect(result.upgradedCount).toBe(3)
    expect(result.deactivatedCount).toBe(0)
    expect(result.year).toBe(new Date().getFullYear())
  })

  it("deactivates grade-9 active students and keeps their grade=9", async () => {
    const caller = await getAuthedCaller("teacher")
    const s9 = await caller.student.create({ fullName: "HS Lop 9", grade: 9, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after9 = await db.student.findUnique({ where: { id: s9.id } })
    expect(after9?.grade).toBe(9)
    expect(after9?.isActive).toBe(false)
    expect(result.upgradedCount).toBe(0)
    expect(result.deactivatedCount).toBe(1)
  })

  it("does NOT touch inactive students", async () => {
    const caller = await getAuthedCaller("teacher")
    const s = await caller.student.create({ fullName: "HS inactive", grade: 3, tuitionFee: 0, isActive: false })

    await caller.student.upgradeAllClasses()

    const after = await db.student.findUnique({ where: { id: s.id } })
    expect(after?.grade).toBe(3)
    expect(after?.isActive).toBe(false)
  })

  it("creates ClassUpgradeLog with trigger='manual' and correct counts", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "AA", grade: 2, tuitionFee: 0, isActive: true })
    await caller.student.create({ fullName: "BB", grade: 9, tuitionFee: 0, isActive: true })

    await caller.student.upgradeAllClasses()

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: new Date().getFullYear() } },
    })
    expect(log).not.toBeNull()
    expect(log?.trigger).toBe("manual")
    expect(log?.upgradedCount).toBe(1)
    expect(log?.deactivatedCount).toBe(1)
  })

  it("throws CONFLICT when called twice in the same year", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "AA", grade: 2, tuitionFee: 0, isActive: true })

    await caller.student.upgradeAllClasses()

    await expect(caller.student.upgradeAllClasses()).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("đã nâng lớp"),
    })
  })

  it("does not affect students of other users", async () => {
    const user2 = await db.user.upsert({
      where: { username: "teacher2" },
      update: {},
      create: {
        username: "teacher2",
        passwordHash: "$2a$04$placeholderplaceholderplaceholderplaceholder",
        fullName: "Teacher 2",
      },
    })
    await db.classUpgradeLog.deleteMany({ where: { userId: user2.id } })
    await db.sessionStudent.deleteMany({ where: { student: { userId: user2.id } } })
    await db.teachingSession.deleteMany({ where: { userId: user2.id } })
    await db.student.deleteMany({ where: { userId: user2.id } })

    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")

    const sA = await callerA.student.create({ fullName: "AA", grade: 2, tuitionFee: 0, isActive: true })
    const sB = await callerB.student.create({ fullName: "BB", grade: 2, tuitionFee: 0, isActive: true })

    await callerA.student.upgradeAllClasses()

    const afterA = await db.student.findUnique({ where: { id: sA.id } })
    const afterB = await db.student.findUnique({ where: { id: sB.id } })
    expect(afterA?.grade).toBe(3)
    expect(afterB?.grade).toBe(2)
  })
})

describe("student.getUpgradeLogThisYear", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
  })

  it("returns null when no log exists", async () => {
    const caller = await getAuthedCaller("teacher")
    const log = await caller.student.getUpgradeLogThisYear()
    expect(log).toBeNull()
  })

  it("returns the log after upgrade", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "AA", grade: 2, tuitionFee: 0, isActive: true })
    await caller.student.upgradeAllClasses()

    const log = await caller.student.getUpgradeLogThisYear()
    expect(log).not.toBeNull()
    expect(log?.year).toBe(new Date().getFullYear())
    expect(log?.trigger).toBe("manual")
  })
})

describe("SessionStudent.grade snapshot", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    vi.useRealTimers()
  })

  it("populates grade snapshot from current Student.grade on session create", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjects = await caller.subject.list({})
    const subject = subjects[0]
    const student = await caller.student.create({
      fullName: "HS Lop 3 Snapshot",
      grade: 3,
      tuitionFee: 0,
      isActive: true,
    })
    const session = await caller.session.create({
      sessionDate: "2099-01-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })
    const ss = await db.sessionStudent.findFirst({
      where: { sessionId: session.id, studentId: student.id },
    })
    expect(ss?.grade).toBe(3)
  })

  it("preserves historical grade after upgradeAllClasses", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjects = await caller.subject.list({})
    const subject = subjects[0]
    const student = await caller.student.create({
      fullName: "HS Lop 3 Historical",
      grade: 3,
      tuitionFee: 0,
      isActive: true,
    })
    const session = await caller.session.create({
      sessionDate: "2099-02-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    const ss = await db.sessionStudent.findFirst({
      where: { sessionId: session.id, studentId: student.id },
    })
    expect(ss?.grade).toBe(3) // historical snapshot unchanged

    const studentAfter = await db.student.findUnique({ where: { id: student.id } })
    expect(studentAfter?.grade).toBe(4) // current grade upgraded
  })

  it("new session after upgrade uses NEW current grade", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjects = await caller.subject.list({})
    const subject = subjects[0]
    const student = await caller.student.create({
      fullName: "HS New After Upgrade",
      grade: 3,
      tuitionFee: 0,
      isActive: true,
    })
    await caller.student.upgradeAllClasses()

    const session = await caller.session.create({
      sessionDate: "2099-08-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })
    const ss = await db.sessionStudent.findFirst({
      where: { sessionId: session.id, studentId: student.id },
    })
    expect(ss?.grade).toBe(4) // current grade after upgrade
  })
})
