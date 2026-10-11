import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

function months() {
  const v = new Date(Date.now() + 7 * 3600_000)
  const y = v.getUTCFullYear()
  const m = v.getUTCMonth() + 1
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const d = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-10`
  return { y, m, py, pm, day: d(y, m), pday: d(py, pm) }
}

describe("Tổng quan: Còn nợ tách tháng này / các tháng trước", () => {
  beforeEach(clean)
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const t = months()
    vi.setSystemTime(new Date(Date.UTC(t.y, t.m - 1, 15, 12, 0, 0)))
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Nợ", grade: 6, tuitionFee: 200_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    for (const date of [t.pday, t.day]) {
      const s = await caller.session.create({ sessionDate: date, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
      await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    }
    return { t, caller, st }
  }

  it("chưa thu gì: 200k tháng trước + 200k tháng này", async () => {
    const { caller } = await setup()
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 400_000, unpaidPrevMonths: 200_000 })
  })

  it("thu 300k trong tháng này: trả nợ cũ trước, còn 100k của tháng này", async () => {
    const { t, caller, st } = await setup()
    await caller.payment.create({ studentId: st.id, year: t.y, month: t.m, amount: 300_000, paidAt: t.day, method: "cash" })
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 100_000, unpaidPrevMonths: 0 })
  })

  // [RF 5] dư trả trước tháng cũ không làm "các tháng trước" âm
  it("tháng trước trả dư: nợ cũ 0, không âm", async () => {
    const { t, caller, st } = await setup()
    await caller.payment.create({ studentId: st.id, year: t.py, month: t.pm, amount: 300_000, paidAt: t.pday, method: "cash" })
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 100_000, unpaidPrevMonths: 0 })
  })
})
