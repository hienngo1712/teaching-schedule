// Spec AM §4.3: Tổng quan có thu nhập nơi dạy + giờ dạy; Cần chú ý có nhóm "Nơi dạy còn thiếu tiền tháng trước" (Pro).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function clean() {
  await db.placePayment.deleteMany()
  await db.placeRateChange.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

const home = { name: "Lớp tại nhà", kind: "home" as const, color: "#4F46E5", billing: "per_student" as const }
const center = { name: "TT Ánh Dương", kind: "center" as const, color: "#0891B2", billing: "per_session" as const }

async function addSession(userId: number, placeId: number, date: string, studentId?: number) {
  const subject = (await db.subject.findFirst({ where: { userId } })) ?? (await db.subject.create({ data: { userId, name: "Toán", color: "#000000" } }))
  return db.teachingSession.create({
    data: {
      userId,
      placeId,
      subjectId: subject.id,
      sessionDate: day(date),
      startTime: time("08:00"),
      endTime: time("09:30"),
      ...(studentId ? { sessionStudents: { create: { studentId, attendance: "present", fee: 150000, grade: 5 } } } : {}),
    },
  })
}

describe("AM: Tổng quan thu nhập nơi dạy", () => {
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0))) // 20/10/2026
  })
  afterEach(() => vi.useRealTimers())

  it("thu nhập = học phí đã dạy + nơi theo ca/giờ; giờ dạy = tổng giờ ca đã dạy mọi nơi", async () => {
    const caller = await getAuthedCaller()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const h = (await caller.place.create(home))!
    const c = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: c.id, unit: "session", amount: 200000, fromYear: 2026, fromMonth: 10 })
    const st = await db.student.create({ data: { userId: u.id, fullName: "HS A", grade: 5, placeId: h.id, tuitionFee: 150000 } })
    await addSession(u.id, h.id, "2026-10-06", st.id)
    await addSession(u.id, c.id, "2026-10-05")
    await addSession(u.id, c.id, "2026-10-25") // chưa dạy: không tính
    await caller.placePayment.create({ placeId: c.id, year: 2026, month: 10, amount: 50000, receivedAt: "2026-10-15" })

    const stats = await caller.report.dashboard()
    expect(stats.totalRevenueMonth).toBe(150000)
    expect(stats).toMatchObject({ placeIncomeMonth: 200000, placeReceivedMonth: 50000, hasPlaceRate: true, teachingHoursMonth: 3 })
  })

  it("chưa có đơn giá: không có thu nhập nơi dạy (hasPlaceRate false), giờ dạy vẫn tính", async () => {
    const caller = await getAuthedCaller()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const c = (await caller.place.create(center))!
    await addSession(u.id, c.id, "2026-10-05")
    expect(await caller.report.dashboard()).toMatchObject({ placeIncomeMonth: 0, placeReceivedMonth: 0, hasPlaceRate: false, teachingHoursMonth: 1.5 })
  })

  it("Cần chú ý: nơi còn thiếu tiền tháng trước (đúng số còn thiếu); nhận đủ thì hết; Standard không gọi được", async () => {
    const caller = await getAuthedCaller()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const c = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: c.id, unit: "session", amount: 200000, fromYear: 2026, fromMonth: 10 })
    await addSession(u.id, c.id, "2026-09-05")
    await addSession(u.id, c.id, "2026-09-12")
    const pay = await caller.placePayment.create({ placeId: c.id, year: 2026, month: 9, amount: 150000, receivedAt: "2026-10-01" })

    const alerts = await caller.report.alerts()
    expect(alerts.placeShortfall).toEqual([{ placeId: c.id, name: "TT Ánh Dương", color: "#0891B2", amount: 250000, year: 2026, month: 9 }])
    await caller.placePayment.delete({ id: pay.id })
    expect((await caller.report.alerts()).placeShortfall[0].amount).toBe(400000)
    await caller.placePayment.create({ placeId: c.id, year: 2026, month: 9, amount: 400000, receivedAt: "2026-10-02" })
    expect((await caller.report.alerts()).placeShortfall).toEqual([])

    const std = await getAuthedCaller("teacher_std")
    await expect(std.report.alerts()).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
