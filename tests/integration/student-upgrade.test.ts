import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
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

  it("upgrades grade 1-11 active students by +1 (lớp 9 → 10, lớp 11 → 12)", async () => {
    const caller = await getAuthedCaller("teacher")
    const s1 = await caller.student.create({ fullName: "HS Lop 1", grade: 1, tuitionFee: 0, isActive: true })
    const s5 = await caller.student.create({ fullName: "HS Lop 5", grade: 5, tuitionFee: 0, isActive: true })
    const s8 = await caller.student.create({ fullName: "HS Lop 8", grade: 8, tuitionFee: 0, isActive: true })
    const s9 = await caller.student.create({ fullName: "HS Lop 9", grade: 9, tuitionFee: 0, isActive: true })
    const s11 = await caller.student.create({ fullName: "HS Lop 11", grade: 11, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after = await Promise.all(
      [s1, s5, s8, s9, s11].map((s) => db.student.findUniqueOrThrow({ where: { id: s.id } }))
    )
    expect(after.map((s) => s.grade)).toEqual([2, 6, 9, 10, 12])
    expect(after.every((s) => s.isActive)).toBe(true)
    expect(result.upgradedCount).toBe(5)
    expect(result.deactivatedCount).toBe(0)
    expect(result.year).toBe(new Date().getFullYear())
  })

  it("lớp 9 KHÔNG bị cho nghỉ: lên lớp 10, vẫn đang học", async () => {
    const caller = await getAuthedCaller("teacher")
    const s9 = await caller.student.create({ fullName: "HS Lop 9", grade: 9, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after9 = await db.student.findUniqueOrThrow({ where: { id: s9.id } })
    expect(after9.grade).toBe(10)
    expect(after9.isActive).toBe(true)
    expect(result.deactivatedCount).toBe(0)
  })

  it("deactivates grade-12 active students and keeps their grade=12", async () => {
    const caller = await getAuthedCaller("teacher")
    const s12 = await caller.student.create({ fullName: "HS Lop 12", grade: 12, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after12 = await db.student.findUnique({ where: { id: s12.id } })
    expect(after12?.grade).toBe(12)
    expect(after12?.isActive).toBe(false)
    expect(result.upgradedCount).toBe(0)
    expect(result.deactivatedCount).toBe(1)
  })

  it("deactivates students with grade > 12 (dữ liệu ngoài [1,12] không bị kẹt)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    // grade 13 không tạo được qua API (zod max 12) → chèn thẳng DB để mô phỏng dữ liệu lỗi.
    const ghost = await db.student.create({
      data: { userId: user.id, fullName: "HS Lop 13", grade: 13, tuitionFee: 0, isActive: true },
    })
    const caller = await getAuthedCaller("teacher")
    const result = await caller.student.upgradeAllClasses()
    const after = await db.student.findUnique({ where: { id: ghost.id } })
    expect(after?.isActive).toBe(false)
    expect(after?.grade).toBe(13)
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
    await caller.student.create({ fullName: "BB", grade: 12, tuitionFee: 0, isActive: true })

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

  it("khớp năm UTC với upgradeAllClasses ở ranh giới năm (không lệch local/UTC)", async () => {
    vi.useFakeTimers()
    // 20:00Z 31/12/2026 = 03:00 01/01/2027 giờ +7. Writer ghi log năm UTC (2026);
    // reader phải đọc cùng năm UTC, không dùng năm local (2027).
    vi.setSystemTime(new Date("2026-12-31T20:00:00Z"))
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "HS NY", grade: 2, tuitionFee: 0, isActive: true })
    await caller.student.upgradeAllClasses()

    const log = await caller.student.getUpgradeLogThisYear()
    expect(log).not.toBeNull()
    expect(log?.year).toBe(2026)
    vi.useRealTimers()
  }, 30_000)
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
    // Ca quá khứ (đã kết thúc) giữ grade lịch sử (spec P5)
    const session = await caller.session.create({
      sessionDate: "2020-02-15",
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

  it("updateStudent đổi grade lúc 18:00 VN → giữ khối ca 16:00–17:00 vừa dạy, đổi khối ca 19:00–20:00 (spec P6)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2099-03-10T11:00:00Z"))
    try {
      const caller = await getAuthedCaller("teacher")
      const subject = (await caller.subject.list({}))[0]
      const student = await caller.student.create({ fullName: "HS Sync VN", grade: 3, tuitionFee: 0, isActive: true })
      const ended = await caller.session.create({ sessionDate: "2099-03-10", startTime: "16:00", endTime: "17:00", subjectId: subject.id, studentIds: [student.id] })
      const upcoming = await caller.session.create({ sessionDate: "2099-03-10", startTime: "19:00", endTime: "20:00", subjectId: subject.id, studentIds: [student.id] })

      await caller.student.update({ id: student.id, data: { grade: 7 } })

      const gradeOf = async (sessionId: number) =>
        (await db.sessionStudent.findFirstOrThrow({ where: { sessionId, studentId: student.id } })).grade
      expect(await gradeOf(ended.id)).toBe(3)
      expect(await gradeOf(upcoming.id)).toBe(7)
    } finally {
      vi.useRealTimers()
    }
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
    // Ca quá khứ (đã kết thúc) giữ grade lịch sử (spec P5)
    await caller.session.create({
      sessionDate: "2020-03-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    const grade3Sessions = await caller.session.getMonth({ year: 2020, month: 3, grade: 3 })
    const grade4Sessions = await caller.session.getMonth({ year: 2020, month: 3, grade: 4 })

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
    // Ca quá khứ (đã kết thúc) giữ grade lịch sử (spec P5)
    await caller.session.create({
      sessionDate: "2020-04-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    // Buổi đã tạo ở lại khối 3 (grade snapshot), không nhảy sang khối 4.
    const grade3 = await caller.report.monthlySummary({ year: 2020, month: 4, grade: 3 })
    const grade4 = await caller.report.monthlySummary({ year: 2020, month: 4, grade: 4 })
    expect(grade3.totalSessions).toBeGreaterThanOrEqual(1)
    expect(grade4.totalSessions).toBe(0)
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

describe("upgradeAllClasses ↔ ca chưa kết thúc theo giờ VN (spec P5)", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    await resetUserData("teacher2")
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // 18:00 VN 15/07/2099. HS lớp 5 + HS lớp 12 học chung; HS lớp 8 đã nghỉ từ trước.
  async function seed() {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2099-07-15T11:00:00Z"))
    const caller = await getAuthedCaller("teacher")
    const subjectId = (await caller.subject.list({}))[0].id
    const g5 = await caller.student.create({ fullName: "HS Lop 5", grade: 5, tuitionFee: 0, isActive: true })
    const g12 = await caller.student.create({ fullName: "HS Lop 12", grade: 12, tuitionFee: 0, isActive: true })
    const g8 = await caller.student.create({ fullName: "HS Lop 8 Nghi", grade: 8, tuitionFee: 0, isActive: true })
    const mk = (sessionDate: string, startTime: string, endTime: string, studentIds: number[]) =>
      caller.session.create({ sessionDate, startTime, endTime, subjectId, studentIds })
    const s = {
      past: await mk("2099-07-14", "08:00", "09:00", [g5.id, g12.id]),
      endedToday: await mk("2099-07-15", "16:00", "17:00", [g5.id, g12.id]),
      laterToday: await mk("2099-07-15", "19:00", "20:00", [g5.id, g12.id]),
      future: await mk("2099-07-20", "08:00", "09:00", [g5.id, g12.id, g8.id]),
      onlyG12: await mk("2099-07-21", "08:00", "09:00", [g12.id]),
    }
    // Nghỉ trước khi lên lớp nhưng vẫn còn trong ca 20/07 (dữ liệu cũ): lên lớp không được đụng.
    await db.student.update({ where: { id: g8.id }, data: { isActive: false } })
    return { caller, g5, g12, g8, s }
  }

  async function links(sessionId: number) {
    return db.sessionStudent.findMany({ where: { sessionId }, select: { studentId: true, grade: true }, orderBy: { studentId: "asc" } })
  }

  async function expectUpgraded({ g5, g12, g8, s }: Awaited<ReturnType<typeof seed>>) {
    expect(await links(s.past.id)).toEqual([{ studentId: g5.id, grade: 5 }, { studentId: g12.id, grade: 12 }])
    expect(await links(s.endedToday.id)).toEqual([{ studentId: g5.id, grade: 5 }, { studentId: g12.id, grade: 12 }])
    expect(await links(s.laterToday.id)).toEqual([{ studentId: g5.id, grade: 6 }])
    expect(await links(s.future.id)).toEqual([{ studentId: g5.id, grade: 6 }, { studentId: g8.id, grade: 8 }])
    // Ca không còn HS vẫn giữ (spec P Q8).
    expect(await links(s.onlyG12.id)).toEqual([])
    expect(await db.teachingSession.findUnique({ where: { id: s.onlyG12.id } })).not.toBeNull()
  }

  it("manual: HS lên lớp mang khối mới ở ca chưa kết thúc; HS lớp 12 bị gỡ; ca đã qua/đã dạy giữ nguyên", async () => {
    const ctx = await seed()
    const res = await ctx.caller.student.upgradeAllClasses()
    expect(res).toMatchObject({ upgradedCount: 1, deactivatedCount: 1, year: 2099 })
    await expectUpgraded(ctx)
  }, 60_000)

  it("auto qua auth.me (từ tháng 7) cho cùng kết quả", async () => {
    const ctx = await seed()
    await ctx.caller.auth.me()
    await expectUpgraded(ctx)
  }, 60_000)

  it("không đụng ca của giáo viên khác", async () => {
    const ctx = await seed()
    const other = await getAuthedCaller("teacher2")
    const otherSubjects = await other.subject.list({})
    const otherSubject = otherSubjects.length > 0 ? otherSubjects[0].id : (await other.subject.create({ name: "Toán K", color: "#0891B2" })).id
    const st = await other.student.create({ fullName: "HS Khac", grade: 5, tuitionFee: 0, isActive: true })
    const ses = await other.session.create({ sessionDate: "2099-07-20", startTime: "10:00", endTime: "11:00", subjectId: otherSubject, studentIds: [st.id] })
    await ctx.caller.student.upgradeAllClasses()
    expect(await links(ses.id)).toEqual([{ studentId: st.id, grade: 5 }])
  }, 60_000)
})

