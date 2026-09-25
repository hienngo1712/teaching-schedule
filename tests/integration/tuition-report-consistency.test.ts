import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { recordPayment } from "../helpers/payment"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

/**
 * Dashboard/Reports "uncollected" must match the tuition page's definition of
 * outstanding: per-student max(0, totalAmountDue - paidAmount), where
 * totalAmountDue includes the carried-over previousBalance. It must NOT be a
 * global netting of period revenue minus period payments (which hides one
 * student's debt behind another student's overpayment and ignores old debt).
 */
describe("Tuition ↔ Report money consistency", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("monthlySummary.totalOutstanding nets per-student — one student's overpay can't hide another's debt", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    // Student X: 100k in May, pays 50k → owes 50k
    const x = await caller.student.create({ fullName: "HS Thiếu", grade: 3, tuitionFee: 100000 })
    const mayX = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: mayX.id, studentIds: [x.id] })
    await caller.attendance.update({
      sessionId: mayX.id,
      attendances: [{ studentId: x.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })
    await recordPayment(caller, { studentId: x.id, year: 2026, month: 5, amount: 50000, isFullPaid: false })

    // Student Y: 100k in May, OVERPAYS 300k → owes 0 (must NOT offset X's debt)
    const y = await caller.student.create({ fullName: "HS Trả Dư", grade: 3, tuitionFee: 100000 })
    const mayY = await caller.session.create({
      sessionDate: "2026-05-12", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: mayY.id, studentIds: [y.id] })
    await caller.attendance.update({
      sessionId: mayY.id,
      attendances: [{ studentId: y.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })
    await recordPayment(caller, { studentId: y.id, year: 2026, month: 5, amount: 300000, isFullPaid: true })

    const summary = await caller.report.monthlySummary({ year: 2026, month: 5 })

    // Old global netting: max(0, 200k revenue - 350k paid) = 0 → hides X's debt.
    // Correct per-student netting: 50k (X) + 0 (Y) = 50k.
    expect(summary.totalOutstanding).toBe(50000)
  }, 60_000)

  it("monthlySummary.totalOutstanding includes carried-over debt from a prior month", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    // Student Z: 150k in April (unpaid). No May session, no May payment.
    const z = await caller.student.create({ fullName: "HS Nợ Cũ", grade: 4, tuitionFee: 150000 })
    const aprZ = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: aprZ.id, studentIds: [z.id] })
    await caller.attendance.update({
      sessionId: aprZ.id,
      attendances: [{ studentId: z.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 150000 }],
    })
    // View April → snapshot the 150k debt so it carries into May
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 4, studentId: z.id })

    const summary = await caller.report.monthlySummary({ year: 2026, month: 5 })

    // May has zero new revenue, but Z still owes 150k from April.
    // Old calc (May revenue 0 - May paid 0) = 0 misses it; correct = 150k.
    expect(summary.totalOutstanding).toBe(150000)
  }, 60_000)
})
