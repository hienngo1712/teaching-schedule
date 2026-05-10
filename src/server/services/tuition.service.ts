import type { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { assertOwnership } from "./_base.service"
import type { MonthlyTuitionFilterInput, UpdatePaymentInput } from "@/lib/schemas/tuition"

export async function getMonthlyTuitionStatus(
  db: PrismaClient,
  userId: number,
  filter: MonthlyTuitionFilterInput
) {
  const { year, month, grade, search, status } = filter

  // 1. Get all active students for this user
  const students = await db.student.findMany({
    where: {
      userId,
      isActive: true,
      ...(grade ? { grade } : {}),
      ...(search ? { fullName: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: [{ grade: "asc" }, { fullName: "asc" }],
  })

  if (students.length === 0) return []

  const studentIds = students.map(s => s.id)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  // 2. Fetch current month attendance records in bulk
  const currentAttendance = await db.sessionStudent.findMany({
    where: {
      studentId: { in: studentIds },
      session: {
        sessionDate: { gte: startDate, lt: endDate },
        userId
      },
    },
    include: { session: true },
  })

  // 3. Fetch existing snapshots for this month
  const existingSnapshots = await db.monthlyTuition.findMany({
    where: {
      studentId: { in: studentIds },
      year,
      month,
    },
  })

  // 4. To calculate missing snapshots, we might need previous month's data
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevSnapshots = await db.monthlyTuition.findMany({
    where: {
      studentId: { in: studentIds },
      year: prevYear,
      month: prevMonth,
    },
  })

  // 5. Check which students need historical calculation (no prev snapshot)
  const studentsNeedingHistory = students.filter(s => 
    !existingSnapshots.some(sn => sn.studentId === s.id) && 
    !prevSnapshots.some(ps => ps.studentId === s.id)
  )

  const historicalBalances: Record<number, number> = {}
  if (studentsNeedingHistory.length > 0) {
    const sIds = studentsNeedingHistory.map(s => s.id)
    const [totalPaidBefore, totalExpectedBefore] = await Promise.all([
      db.monthlyTuition.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: sIds },
          OR: [
            { year: { lt: year } },
            { year: year, month: { lt: month } }
          ]
        },
        _sum: { paidAmount: true }
      }),
      db.sessionStudent.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: sIds },
          session: { sessionDate: { lt: startDate }, userId },
          attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] }
        },
        _sum: { fee: true }
      })
    ])

    studentsNeedingHistory.forEach(s => {
      const paid = totalPaidBefore.find(t => t.studentId === s.id)?._sum?.paidAmount ?? 0
      const expected = totalExpectedBefore.find(t => t.studentId === s.id)?._sum?.fee ?? 0
      historicalBalances[s.id] = expected - paid
    })
  }

  // 6. Process each student and update snapshots if needed
  const results = await Promise.all(students.map(async (student) => {
    const studentAttendance = currentAttendance.filter(a => a.studentId === student.id)
    const totalSessions = studentAttendance.length
    const presentSessions = studentAttendance.filter(a => 
      a.attendance === ATTENDANCE_STATUS.PRESENT || a.attendance === ATTENDANCE_STATUS.LATE
    ).length
    const currentMonthFee = studentAttendance.reduce((sum, a) => {
      if (a.attendance === ATTENDANCE_STATUS.PRESENT || a.attendance === ATTENDANCE_STATUS.LATE) {
        return sum + a.fee
      }
      return sum
    }, 0)

    let snapshot = existingSnapshots.find(sn => sn.studentId === student.id)
    let previousBalance = 0

    if (snapshot) {
      previousBalance = snapshot.previousBalance
    } else {
      const prevSnapshot = prevSnapshots.find(ps => ps.studentId === student.id)
      if (prevSnapshot) {
        previousBalance = prevSnapshot.totalAmountDue - prevSnapshot.paidAmount
      } else {
        previousBalance = historicalBalances[student.id] ?? 0
      }
    }

    const totalAmountDue = previousBalance + currentMonthFee

    // Update or Create Snapshot if data changed or missing
    // We only update if it's the current month (live) or if missing
    const isCurrentMonth = year === new Date().getFullYear() && month === (new Date().getMonth() + 1)
    
    if (!snapshot || (isCurrentMonth && (
      snapshot.totalSessions !== totalSessions || 
      snapshot.presentSessions !== presentSessions || 
      snapshot.currentMonthFee !== currentMonthFee || 
      snapshot.totalAmountDue !== totalAmountDue
    ))) {
      snapshot = await db.monthlyTuition.upsert({
        where: { studentId_year_month: { studentId: student.id, year, month } },
        update: {
          totalSessions,
          presentSessions,
          currentMonthFee,
          totalAmountDue,
          previousBalance,
        },
        create: {
          studentId: student.id,
          year,
          month,
          totalSessions,
          presentSessions,
          currentMonthFee,
          totalAmountDue,
          previousBalance,
          paidAmount: 0,
          isFullPaid: false,
        }
      })
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      grade: student.grade,
      totalSessions: snapshot.totalSessions,
      presentSessions: snapshot.presentSessions,
      totalExpected: snapshot.currentMonthFee,
      paidAmount: snapshot.paidAmount,
      isFullPaid: snapshot.isFullPaid,
      notes: snapshot.notes,
      previousBalance: snapshot.previousBalance,
      totalAmountDue: snapshot.totalAmountDue,
    }
  }))

  // 7. Filter by status
  if (!status || status === 'all') return results

  return results.filter(item => {
    const adjustedAmount = Math.max(0, item.totalAmountDue)
    
    switch (status) {
      case 'fully_paid':
        return item.paidAmount >= adjustedAmount && adjustedAmount > 0
      case 'paid_this_month':
        return item.paidAmount >= item.totalExpected && item.totalExpected > 0 && item.previousBalance > 0 && item.paidAmount < adjustedAmount
      case 'partial':
        return item.paidAmount > 0 && item.paidAmount < item.totalExpected
      case 'unpaid':
        return item.paidAmount === 0 && adjustedAmount > 0
      default:
        return true
    }
  })
}

export async function updateTuitionPayment(
  db: PrismaClient,
  userId: number,
  input: UpdatePaymentInput
) {
  const { studentId, year, month, paidAmount, isFullPaid, notes } = input

  // Verify student ownership
  const student = await db.student.findUnique({ where: { id: studentId } })
  await assertOwnership(student, userId)

  return await db.monthlyTuition.upsert({
    where: {
      studentId_year_month: {
        studentId,
        year,
        month,
      },
    },
    update: {
      paidAmount,
      isFullPaid,
      notes,
    },
    create: {
      studentId,
      year,
      month,
      paidAmount,
      isFullPaid,
      notes,
      // Note: In reality, we should ensure snapshot fields are also initialized here 
      // if updatePayment is called before getMonthlyTuitionStatus.
      // But usually UI flow goes through status list first.
    },
  })
}
