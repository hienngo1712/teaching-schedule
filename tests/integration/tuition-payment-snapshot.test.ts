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
 * Recording a payment for a month that has NOT been viewed yet must not freeze
 * the carried-over previousBalance at 0. updateTuitionPayment used to create a
 * bare snapshot (previousBalance defaulted to 0); the month view then trusted
 * that 0 and silently dropped prior-month debt.
 */
describe("Tuition payment snapshot — carry-over not lost", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("paying for a not-yet-viewed month keeps the prior month's debt as previousBalance", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({ fullName: "HS Nợ Dồn", grade: 5, tuitionFee: 100000 })

    // April: present, owes 150k. View April so its debt is snapshotted.
    const apr = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: apr.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: apr.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 150000 }],
    })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 4, studentId: student.id })

    // May: present, fee 100k.
    const may = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: may.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: may.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })

    // Record a May payment WITHOUT viewing May first (the bug trigger).
    await recordPayment(caller, { studentId: student.id, year: 2026, month: 5, amount: 200000, isFullPaid: false })

    const status = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5, studentId: student.id })

    expect(status.items[0].previousBalance).toBe(150000) // April debt carried, not frozen at 0
    expect(status.items[0].totalExpected).toBe(100000)    // May current fee
    expect(status.items[0].totalAmountDue).toBe(250000)   // 150k + 100k
    expect(status.items[0].paidAmount).toBe(200000)       // still owes 50k
  }, 60_000)
})
