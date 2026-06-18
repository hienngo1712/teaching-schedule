import { describe, expect, it, beforeEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import * as studentService from "@/server/services/student.service"

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

  it("deactivates students with grade > 9 (dữ liệu ngoài [1,9] không bị kẹt)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    // grade 10 không tạo được qua API (zod max 9) → chèn thẳng DB để mô phỏng dữ liệu lỗi.
    const ghost = await db.student.create({
      data: { userId: user.id, fullName: "HS Lop 10", grade: 10, tuitionFee: 0, isActive: true },
    })
    const caller = await getAuthedCaller("teacher")
    const result = await caller.student.upgradeAllClasses()
    const after = await db.student.findUnique({ where: { id: ghost.id } })
    expect(after?.isActive).toBe(false)
    expect(result.deactivatedCount).toBeGreaterThanOrEqual(1)
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

  it("updateStudent đổi grade → đồng bộ grade buổi tương lai, giữ buổi quá khứ", async () => {
    const caller = await getAuthedCaller("teacher")
    const subject = (await caller.subject.list({}))[0]
    const student = await caller.student.create({
      fullName: "HS Sync Grade",
      grade: 3,
      tuitionFee: 0,
      isActive: true,
    })
    const past = await caller.session.create({
      sessionDate: "2020-01-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })
    const future = await caller.session.create({
      sessionDate: "2099-01-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.update({ id: student.id, data: { grade: 7 } })

    const pastSS = await db.sessionStudent.findFirst({
      where: { sessionId: past.id, studentId: student.id },
    })
    const futureSS = await db.sessionStudent.findFirst({
      where: { sessionId: future.id, studentId: student.id },
    })
    expect(pastSS?.grade).toBe(3) // lịch sử giữ nguyên
    expect(futureSS?.grade).toBe(7) // buổi tương lai đồng bộ grade mới
  }, 30_000)

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

describe("Historical grade filtering after upgrade", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    vi.useRealTimers()
  })

  it("session.getMonth with grade=3 returns past session even after student upgraded to grade 4", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjects = await caller.subject.list({})
    const subject = subjects[0]
    const student = await caller.student.create({
      fullName: "HS3 Historical Filter",
      grade: 3,
      tuitionFee: 0,
      isActive: true,
    })
    await caller.session.create({
      sessionDate: "2099-03-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    const grade3Sessions = await caller.session.getMonth({ year: 2099, month: 3, grade: 3 })
    const grade4Sessions = await caller.session.getMonth({ year: 2099, month: 3, grade: 4 })

    expect(grade3Sessions.length).toBe(1)
    expect(grade4Sessions.length).toBe(0)
  })

  it("report.monthlySummary counts students by historical snapshot grade", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjects = await caller.subject.list({})
    const subject = subjects[0]
    const student = await caller.student.create({
      fullName: "HS3 Historical Report",
      grade: 3,
      tuitionFee: 0,
      isActive: true,
    })
    await caller.session.create({
      sessionDate: "2099-04-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    const summary = await caller.report.monthlySummary({ year: 2099, month: 4 })
    const grade3Bucket = summary.byGrade.find((g) => g.grade === 3)
    const grade4Bucket = summary.byGrade.find((g) => g.grade === 4)
    expect(grade3Bucket?.sessionCount ?? 0).toBeGreaterThanOrEqual(1)
    expect(grade4Bucket?.sessionCount ?? 0).toBe(0)
  }, 30_000)
})

describe("Lazy auto-upgrade via auth.me", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    vi.useRealTimers()
  })

  it("auto-runs upgrade when calling auth.me on July 1st and no log exists", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-07-01T00:00:00Z"))

    const caller = await getAuthedCaller("teacher")
    const student = await caller.student.create({
      fullName: "HS Auto",
      grade: 2,
      tuitionFee: 0,
      isActive: true,
    })

    await caller.auth.me()

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log).not.toBeNull()
    expect(log?.trigger).toBe("auto")

    const after = await db.student.findUnique({ where: { id: student.id } })
    expect(after?.grade).toBe(3)

    vi.useRealTimers()
  })

  it("does NOT auto-run before July (e.g. June)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-06-30T23:59:00Z"))

    const caller = await getAuthedCaller("teacher")
    const student = await caller.student.create({
      fullName: "HS June",
      grade: 2,
      tuitionFee: 0,
      isActive: true,
    })

    await caller.auth.me()

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log).toBeNull()

    const after = await db.student.findUnique({ where: { id: student.id } })
    expect(after?.grade).toBe(2)

    vi.useRealTimers()
  })

  it("does NOT re-run when log already exists for current year", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-07-15T00:00:00Z"))

    const caller = await getAuthedCaller("teacher")
    const student = await caller.student.create({
      fullName: "HS Pre-upgraded",
      grade: 2,
      tuitionFee: 0,
      isActive: true,
    })

    // Manual upgrade first
    await caller.student.upgradeAllClasses()
    const studentAfterManual = await db.student.findUniqueOrThrow({ where: { id: student.id } })
    expect(studentAfterManual.grade).toBe(3)

    // auth.me should NOT re-run upgrade
    await caller.auth.me()

    const after = await db.student.findUniqueOrThrow({ where: { id: student.id } })
    expect(after.grade).toBe(3) // unchanged from manual upgrade

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUniqueOrThrow({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log.trigger).toBe("manual") // not overwritten by auto

    vi.useRealTimers()
  })

  it("auth.me still returns user even if auto-upgrade throws", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-07-02T00:00:00Z"))

    const spy = vi
      .spyOn(studentService, "upgradeAllClasses")
      .mockRejectedValueOnce(new Error("simulated DB failure"))

    const caller = await getAuthedCaller("teacher")
    const result = await caller.auth.me()

    expect(result.username).toBe("teacher")
    expect(spy).toHaveBeenCalledOnce()

    // No log should have been written since upgrade threw
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log).toBeNull()

    spy.mockRestore()
    vi.useRealTimers()
  })
})
