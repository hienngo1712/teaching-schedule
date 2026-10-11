import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { monthKey } from "@/lib/billing"
import { recordPlaceChange } from "@/server/services/billing.service"
import { getAuthedCaller } from "../helpers/trpc"

// Tháng "hiện tại" của test: 10/2026 (tháng trước 9/2026).
const NOW = new Date(Date.UTC(2026, 9, 20, 5, 0, 0))
const CUR = monthKey(2026, 10)

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

async function makePlace(userId: number, name: string, kind: string, changes: [number, string][]) {
  return db.teachingPlace.create({
    data: { userId, name, kind, color: "#4F46E5", billingChanges: { create: changes.map(([fromKey, billing]) => ({ fromKey, billing })) } },
  })
}

describe("AL: học phí theo nơi học (per_session → 0)", () => {
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const caller = await getAuthedCaller("teacher")
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const home = await makePlace(user.id, "Lớp tại nhà", "home", [[0, "per_student"]])
    const center = await makePlace(user.id, "TT Ánh Dương", "center", [[0, "per_session"]])
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const newStudent = async (name: string, placeId: number) => {
      const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: name, grade: 6, tuitionFee: 200_000 })
      await db.student.update({ where: { id: st.id }, data: { placeId } })
      await recordPlaceChange(db, st.id, placeId, 0)
      return st
    }
    const attend = async (studentId: number, date: string) => {
      const s = await caller.session.create({ sessionDate: date, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [studentId] })
      await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId, attendance: "present" }] })
    }
    const list = (month: number) => caller.tuition.getMonthlyStatus({ year: 2026, month, status: "all", page: 1, limit: 100 })
    return { caller, home, center, newStudent, attend, list }
  }

  it("HS ở trung tâm per_session: không vào Học phí, doanh thu/dự kiến/còn nợ = 0", async () => {
    const { caller, center, newStudent, attend, list } = await setup()
    const st = await newStudent("HS Trung tâm", center.id)
    await attend(st.id, "2026-10-05")
    expect((await list(10)).items.map((i) => i.studentId)).not.toContain(st.id)
    expect(await caller.report.dashboard()).toMatchObject({ totalRevenueMonth: 0, expectedRevenueMonth: 0, totalUnpaidMonth: 0 })
    expect(await caller.report.monthlySummary({ year: 2026, month: 10 })).toMatchObject({ totalRevenue: 0, expectedRevenue: 0 })
  })

  // [RF 1] [RF 5] HS nợ T9 ở nơi theo học sinh, T10 chuyển sang trung tâm.
  it("chuyển nơi per_session từ tháng này: nợ T9 còn, snapshot T9 không bị ghi đè, phí T10 = 0, vẫn hiện ở Học phí", async () => {
    const { caller, home, center, newStudent, attend, list } = await setup()
    const st = await newStudent("HS Chuyển", home.id)
    await attend(st.id, "2026-09-10")
    await list(9) // GV xem tháng 9 → ghi snapshot
    const snapBefore = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId: st.id, year: 2026, month: 9 } } })
    expect(snapBefore.currentMonthFee).toBe(200_000)

    await db.student.update({ where: { id: st.id }, data: { placeId: center.id } })
    await recordPlaceChange(db, st.id, center.id, CUR)
    await attend(st.id, "2026-10-08")

    const row = (await list(10)).items.find((i) => i.studentId === st.id)
    expect(row).toMatchObject({ previousBalance: 200_000, totalExpected: 0, totalAmountDue: 200_000 })
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 200_000, unpaidPrevMonths: 200_000 })

    await list(9)
    const snapAfter = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId: st.id, year: 2026, month: 9 } } })
    expect(snapAfter).toEqual(snapBefore)
  })

  it("cả nơi đổi sang per_session từ tháng này: tháng trước giữ nguyên số", async () => {
    const { caller, home, newStudent, attend } = await setup()
    const st = await newStudent("HS Nhà", home.id)
    await attend(st.id, "2026-09-10")
    await attend(st.id, "2026-10-10")
    const sepBefore = await caller.report.monthlySummary({ year: 2026, month: 9 })
    expect(sepBefore.totalRevenue).toBe(200_000)

    await db.placeBillingChange.create({ data: { placeId: home.id, fromKey: CUR, billing: "per_session" } })

    expect(await caller.report.monthlySummary({ year: 2026, month: 9 })).toEqual(sepBefore)
    expect(await caller.report.monthlySummary({ year: 2026, month: 10 })).toMatchObject({ totalRevenue: 0 })
  })

  it("tài khoản chỉ có nơi theo học sinh: số liệu như trước AL", async () => {
    const { caller, home, newStudent, attend, list } = await setup()
    await db.teachingPlace.deleteMany({ where: { name: "TT Ánh Dương" } })
    const st = await newStudent("HS Thường", home.id)
    await attend(st.id, "2026-10-05")
    expect((await list(10)).items.find((i) => i.studentId === st.id)).toMatchObject({ totalExpected: 200_000 })
    expect(await caller.report.dashboard()).toMatchObject({ totalRevenueMonth: 200_000, totalUnpaidMonth: 200_000 })
  })
})
