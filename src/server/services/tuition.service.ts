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

  // 2. Define month range
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  // 3. Fetch all attendance records for these students in this month
  const studentIds = students.map(s => s.id)
  const attendanceRecords = await db.sessionStudent.findMany({
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

  // 4. Fetch existing MonthlyTuition records
  const monthlyTuitions = await db.monthlyTuition.findMany({
    where: {
      studentId: { in: studentIds },
      year,
      month,
    },
  })

  // 5. Combine data
  return students.map(student => {
    const studentAttendance = attendanceRecords.filter(r => r.studentId === student.id)
    
    // Calculate expected tuition (Present or Late)
    const totalExpected = studentAttendance.reduce((sum, record) => {
      if (record.attendance === ATTENDANCE_STATUS.PRESENT || record.attendance === ATTENDANCE_STATUS.LATE) {
        return sum + record.fee
      }
      return sum
    }, 0)

    const totalSessions = studentAttendance.length
    const presentSessions = studentAttendance.filter(r => r.attendance === ATTENDANCE_STATUS.PRESENT || r.attendance === ATTENDANCE_STATUS.LATE).length

    const tuitionRecord = monthlyTuitions.find(t => t.studentId === student.id)

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
