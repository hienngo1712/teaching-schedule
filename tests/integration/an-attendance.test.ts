// Spec AN §3: Chuyên cần — tháng (Plus), năm học T9→T5 (Pro), lọc nơi / lớp.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

describe("AN: Chuyên cần", () => {
  let userId: number
  let subjectId: number
  let homeId: number
  let centerId: number

  async function session(date: string, links: [number, string, number?][], opts: { status?: string; placeId?: number } = {}) {
    return db.teachingSession.create({
      data: {
        userId, subjectId, placeId: opts.placeId ?? homeId, sessionDate: day(date), startTime: time("08:00"), endTime: time("09:30"),
        status: opts.status ?? "scheduled",
        sessionStudents: { create: links.map(([studentId, attendance, grade]) => ({ studentId, attendance, grade: grade ?? 5 })) },
      },
    })
  }

  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2027, 5, 20, 5, 0, 0))) // 20/6/2027
    const caller = await getAuthedCaller()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    userId = u.id
    subjectId = (await db.subject.findFirstOrThrow({ where: { userId } })).id
    homeId = (await caller.place.create({ name: "Lớp tại nhà", kind: "home", color: "#4F46E5", billing: "per_student" }))!.id
    centerId = (await caller.place.create({ name: "TT Ánh Dương", kind: "center", color: "#0891B2", billing: "per_session" }))!.id
  })
  afterEach(() => vi.useRealTimers())

  it("tháng: tỉ lệ = (có mặt + muộn) / đã điểm danh; ca huỷ và pending không tính; HS đã xoá vẫn có ở tháng cũ [RF 4]", async () => {
    const caller = await getAuthedCaller()
    const an = await db.student.create({ data: { userId, fullName: "An", grade: 5, placeId: homeId } })
    const binh = await db.student.create({ data: { userId, fullName: "Bình", grade: 6, placeId: homeId } })
    await session("2026-10-02", [[an.id, "present"], [binh.id, "absent", 6]])
    await session("2026-10-09", [[an.id, "late"], [binh.id, "present", 6]])
    await session("2026-10-16", [[an.id, "absent"], [binh.id, "pending", 6]])
    await session("2026-10-23", [[an.id, "present"], [binh.id, "present", 6]], { status: "cancelled" })
    await db.student.update({ where: { id: binh.id }, data: { isDeleted: true, deletedAt: new Date() } })

    const r = await caller.attendanceReport.month({ year: 2026, month: 10 })
    expect(r.students.map((s) => [s.fullName, s.present, s.late, s.absent, s.recorded, s.rate])).toEqual([
      ["An", 2, 1, 1, 3, 66.7],
      ["Bình", 1, 0, 1, 2, 50],
    ])
    expect(r.stats).toEqual({ present: 3, late: 1, absent: 2, recorded: 5, rate: 60 })
  })

  it("lọc nơi dạy (theo nơi của ca) và lọc lớp (lớp lúc học)", async () => {
    const caller = await getAuthedCaller()
    const an = await db.student.create({ data: { userId, fullName: "An", grade: 5 } })
    const chi = await db.student.create({ data: { userId, fullName: "Chi", grade: 7 } })
    await session("2026-10-02", [[an.id, "present"]], { placeId: homeId })
    await session("2026-10-03", [[an.id, "absent"], [chi.id, "present", 7]], { placeId: centerId })
    expect((await caller.attendanceReport.month({ year: 2026, month: 10, placeId: centerId })).students.map((s) => [s.fullName, s.recorded])).toEqual([
      ["An", 1],
      ["Chi", 1],
    ])
    expect((await caller.attendanceReport.month({ year: 2026, month: 10, grade: 7 })).students.map((s) => s.fullName)).toEqual(["Chi"])
  })

  it("[RF 5] năm học 2026–2027 = T9/2026 → T5/2027 (9 tháng, qua năm không lệch); tỉ lệ cả năm", async () => {
    const caller = await getAuthedCaller()
    const an = await db.student.create({ data: { userId, fullName: "An", grade: 5 } })
    await session("2026-08-30", [[an.id, "absent"]]) // ngoài năm học
    await session("2026-09-05", [[an.id, "present"]])
    await session("2026-12-31", [[an.id, "absent"]])
    await session("2027-01-02", [[an.id, "present"]])
    await session("2027-05-31", [[an.id, "late"]])
    await session("2027-06-01", [[an.id, "absent"]]) // ngoài năm học
    const r = await caller.attendanceReport.schoolYear({ startYear: 2026 })
    expect(r.months.map((m) => `${m.month}/${m.year}`)).toEqual(["9/2026", "10/2026", "11/2026", "12/2026", "1/2027", "2/2027", "3/2027", "4/2027", "5/2027"])
    const s = r.students[0]
    expect(s.months.map((m) => m.rate)).toEqual([100, null, null, 0, 100, null, null, null, 100])
    expect([s.present, s.recorded, s.rate]).toEqual([3, 4, 75])
  })

  it("gói: Standard → FORBIDDEN; Plus xem tháng được, năm học / lọc lớp → FORBIDDEN", async () => {
    const std = await getAuthedCaller("teacher_std")
    await expect(std.attendanceReport.month({ year: 2026, month: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    const t2 = await db.user.findUniqueOrThrow({ where: { username: "teacher2" } })
    await db.user.update({ where: { id: t2.id }, data: { plan: "plus", planExpiresAt: new Date(Date.UTC(2099, 0, 1)), trialEndsAt: null } })
    try {
      const plus = await getAuthedCaller("teacher2")
      expect((await plus.attendanceReport.month({ year: 2026, month: 10 })).students).toEqual([])
      await expect(plus.attendanceReport.schoolYear({ startYear: 2026 })).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(plus.attendanceReport.month({ year: 2026, month: 10, grade: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    } finally {
      await db.user.update({ where: { id: t2.id }, data: { plan: "pro" } })
    }
  })
})
