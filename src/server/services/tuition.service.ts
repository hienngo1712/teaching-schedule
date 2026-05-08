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

  // 2. Define range for current month
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))
  
  // 3. Fetch current month attendance records
  const studentIds = students.map(s => s.id)
  const currentAttendance = await db.sessionStudent.findMany({
    where: {
      studentId: { in: studentIds },
      session: {
        sessionDate: {
          gte: startDate,
          lt: endDate,
        },
      },
    },
    include: {
      session: true,
    },
  })

  // 4. Fetch cumulative statistics for previous months
  // Sum of all paid amounts before this month
  const totalPaidBefore = await db.monthlyTuition.groupBy({
    by: ['studentId'],
    where: {
      studentId: { in: studentIds },
      OR: [
        { year: { lt: year } },
        { year: year, month: { lt: month } }
      ]
    },
    _sum: {
      paidAmount: true
    }
  })

  // Sum of all expected fees before this month
  const totalExpectedBefore = await db.sessionStudent.groupBy({
    by: ['studentId'],
    where: {
      studentId: { in: studentIds },
      session: {
        sessionDate: { lt: startDate }
      },
      attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] }
    },
    _sum: {
      fee: true
    }
  })

  // 5. Fetch current month's tuition record
  const currentTuitions = await db.monthlyTuition.findMany({
    where: {
      studentId: { in: studentIds },
      year,
      month,
    },
  })

  // 6. Combine data
  const results = students.map(student => {
    // Current month stats
    const studentCurrentAttendance = currentAttendance.filter(r => r.studentId === student.id)
    
    const totalExpected = studentCurrentAttendance.reduce((sum, record) => {
      if (record.attendance === ATTENDANCE_STATUS.PRESENT || record.attendance === ATTENDANCE_STATUS.LATE) {
        return sum + record.fee
      }
      return sum
    }, 0)

    const totalSessions = studentCurrentAttendance.length
    const presentSessions = studentCurrentAttendance.filter(r => r.attendance === ATTENDANCE_STATUS.PRESENT || r.attendance === ATTENDANCE_STATUS.LATE).length

    // Cumulative previous balance (Debt = Expected - Paid)
    const paidBefore = totalPaidBefore.find(t => t.studentId === student.id)?._sum?.paidAmount ?? 0
    const expectedBefore = totalExpectedBefore.find(t => t.studentId === student.id)?._sum?.fee ?? 0
    const previousBalance = expectedBefore - paidBefore

    // Current month tuition record
    const tuitionRecord = currentTuitions.find(t => t.studentId === student.id)

    return {
      studentId: student.id,
      fullName: student.fullName,
      grade: student.grade,
      totalSessions,
      presentSessions,
      totalExpected,
      paidAmount: tuitionRecord?.paidAmount ?? 0,
      isFullPaid: tuitionRecord?.isFullPaid ?? false,
      notes: tuitionRecord?.notes ?? null,
      previousBalance,
    }
  })

  // 7. Filter by status if requested
  if (!status || status === 'all') return results

  return results.filter(item => {
    const adjustedAmount = Math.max(0, item.totalExpected + item.previousBalance)
    
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
    },
  })
}
