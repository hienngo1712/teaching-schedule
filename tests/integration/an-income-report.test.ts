// Spec AN §4–5: Thu nhập 12 tháng (Pro) + Báo cáo lọc theo nơi học.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function clean() {
  await db.placePayment.deleteMany()
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

describe("AN: Thu nhập 12 tháng + Báo cáo lọc nơi học", () => {
  let userId: number
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0))) // 20/10/2026
    userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
  })
  afterEach(() => vi.useRealTimers())

  it("income.last12: 12 tháng T11/2025 → T10/2026 tăng dần; học phí đã thu + nơi dạy đã nhận theo tháng", async () => {
    const caller = await getAuthedCaller()
    const home = (await caller.place.create({ name: "Lớp tại nhà", kind: "home", color: "#4F46E5", billing: "per_student" }))!
    const center = (await caller.place.create({ name: "TT Ánh Dương", kind: "center", color: "#0891B2", billing: "per_session" }))!
    const st = await db.student.create({ data: { userId, fullName: "An", grade: 5, placeId: home.id } })
    await db.monthlyTuition.create({ data: { studentId: st.id, year: 2026, month: 9, paidAmount: 400000 } })
    await db.monthlyTuition.create({ data: { studentId: st.id, year: 2025, month: 10, paidAmount: 999 } }) // ngoài 12 tháng
    await caller.placePayment.create({ placeId: center.id, year: 2026, month: 9, amount: 500000, receivedAt: "2026-10-01" })
    const del = await caller.placePayment.create({ placeId: center.id, year: 2026, month: 10, amount: 7, receivedAt: "2026-10-02" })
    await caller.placePayment.delete({ id: del.id })
    await caller.placePayment.create({ placeId: center.id, year: 2026, month: 10, amount: 300000, receivedAt: "2026-10-15" })

    const r = await caller.income.last12()
    expect(r).toHaveLength(12)
    expect([r[0].year, r[0].month, r[11].year, r[11].month]).toEqual([2025, 11, 2026, 10])
    expect(r.find((m) => m.year === 2026 && m.month === 9)).toEqual({ year: 2026, month: 9, tuition: 400000, places: 500000 })
    expect(r.find((m) => m.month === 10 && m.year === 2026)).toEqual({ year: 2026, month: 10, tuition: 0, places: 300000 })
    expect(r.reduce((a, m) => a + m.tuition + m.places, 0)).toBe(1200000)
  })

  it("income.last12: Plus → FORBIDDEN", async () => {
    const t2 = await db.user.findUniqueOrThrow({ where: { username: "teacher2" } })
    await db.user.update({ where: { id: t2.id }, data: { plan: "plus" } })
    try {
      await expect((await getAuthedCaller("teacher2")).income.last12()).rejects.toMatchObject({ code: "FORBIDDEN" })
    } finally {
      await db.user.update({ where: { id: t2.id }, data: { plan: "pro" } })
    }
  })

  it("report.monthlySummary lọc nơi học: chỉ tính HS nơi đó (số HS, doanh thu, đã thu)", async () => {
    const caller = await getAuthedCaller()
    const a = (await caller.place.create({ name: "Lớp tại nhà", kind: "home", color: "#4F46E5", billing: "per_student" }))!
    const b = (await caller.place.create({ name: "Nhóm GS Cầu Giấy", kind: "tutor", color: "#DB2777", billing: "per_student" }))!
    const subjectId = (await db.subject.findFirstOrThrow({ where: { userId } })).id
    const an = await db.student.create({ data: { userId, fullName: "An", grade: 5, placeId: a.id } })
    const binh = await db.student.create({ data: { userId, fullName: "Bình", grade: 5, placeId: b.id } })
    await db.teachingSession.create({
      data: {
        userId, subjectId, placeId: a.id, sessionDate: day("2026-10-05"), startTime: time("08:00"), endTime: time("09:30"),
        sessionStudents: { create: [{ studentId: an.id, attendance: "present", fee: 150000, grade: 5 }, { studentId: binh.id, attendance: "present", fee: 200000, grade: 5 }] },
      },
    })
    await db.monthlyTuition.create({ data: { studentId: an.id, year: 2026, month: 10, paidAmount: 150000 } })
    await db.monthlyTuition.create({ data: { studentId: binh.id, year: 2026, month: 10, paidAmount: 200000 } })

    const all = await caller.report.monthlySummary({ year: 2026, month: 10 })
    const onlyB = await caller.report.monthlySummary({ year: 2026, month: 10, placeId: b.id })
    expect([all.totalStudents, all.totalRevenue, all.totalPaid]).toEqual([2, 350000, 350000])
    expect([onlyB.totalStudents, onlyB.totalRevenue, onlyB.totalPaid]).toEqual([1, 200000, 200000])
  })
})
