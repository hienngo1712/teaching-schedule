import type { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { assertOwnership } from "./_base.service"
import type { MonthlyTuitionFilterInput, UpdatePaymentInput } from "@/lib/schemas/tuition"

export async function getMonthlyTuitionStatus(
  db: PrismaClient,
  userId: number,
  filter: MonthlyTuitionFilterInput
) {
  const { year, month, grade, search } = filter

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

  // 2. Define ranges for current and previous month
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))
  
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevStartDate = new Date(Date.UTC(prevYear, prevMonth - 1, 1))

  // 3. Fetch all attendance records for these students in both current and previous months
  const studentIds = students.map(s => s.id)
  const allAttendance = await db.sessionStudent.findMany({
    where: {
      studentId: { in: studentIds },
      session: {
        sessionDate: {
          gte: prevStartDate,
          lt: endDate,
        },
      },
    },
    include: {
      session: true,
    },
  })

  // 4. Fetch existing MonthlyTuition records for current and previous month
  const monthlyTuitions = await db.monthlyTuition.findMany({
    where: {
      studentId: { in: studentIds },
      OR: [
        { year, month },
        { year: prevYear, month: prevMonth },
      ],
    },
  })

  // 5. Combine data
  return students.map(student => {
    const studentAttendance = allAttendance.filter(r => r.studentId === student.id)
    
    // Current month stats
    const currentSessions = studentAttendance.filter(r => {
      const d = r.session.sessionDate
      return d >= startDate && d < endDate
    })
    
    const totalExpected = currentSessions.reduce((sum, record) => {
      if (record.attendance === ATTENDANCE_STATUS.PRESENT || record.attendance === ATTENDANCE_STATUS.LATE) {
        return sum + record.fee
      }
      return sum
    }, 0)

    const totalSessions = currentSessions.length
    const presentSessions = currentSessions.filter(r => r.attendance === ATTENDANCE_STATUS.PRESENT || r.attendance === ATTENDANCE_STATUS.LATE).length

    // Previous month balance
    const prevSessions = studentAttendance.filter(r => {
      const d = r.session.sessionDate
      return d >= prevStartDate && d < startDate
    })

    const prevExpected = prevSessions.reduce((sum, record) => {
      if (record.attendance === ATTENDANCE_STATUS.PRESENT || record.attendance === ATTENDANCE_STATUS.LATE) {
        return sum + record.fee
      }
      return sum
    }, 0)

    const prevTuition = monthlyTuitions.find(t => t.studentId === student.id && t.year === prevYear && t.month === prevMonth)
    const previousBalance = (prevTuition?.paidAmount ?? 0) - prevExpected

    // Current month tuition record
    const tuitionRecord = monthlyTuitions.find(t => t.studentId === student.id && t.year === year && t.month === month)

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
      previousBalance, // New field
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
