import type { PrismaClient, MonthlyTuition, SessionStudent } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { assertOwnership } from "./_base.service"
import type { MonthlyTuitionFilterInput, UpdatePaymentInput } from "@/lib/schemas/tuition"
import type { PaginatedResponse } from "@/lib/schemas/common"
import type { TuitionStatusDTO } from "@/lib/types/models"

type AttendanceRecord = SessionStudent & { session: { sessionDate: Date } }

function calcStudentTuition(
  studentId: number,
  attendance: AttendanceRecord[],
  snapshot: MonthlyTuition | undefined,
  prevSnapshot: MonthlyTuition | undefined,
  historicalBalance: number,
  year: number,
  month: number,
): {
  totalSessions: number
  presentSessions: number
  currentMonthFee: number
  previousBalance: number
  totalAmountDue: number
  needsUpsert: boolean
} {
  const totalSessions = attendance.length
  const presentSessions = attendance.filter(
    a => a.attendance === ATTENDANCE_STATUS.PRESENT || a.attendance === ATTENDANCE_STATUS.LATE
  ).length
  const currentMonthFee = attendance.reduce((sum, a) => {
    if (a.attendance === ATTENDANCE_STATUS.PRESENT || a.attendance === ATTENDANCE_STATUS.LATE) {
      return sum + a.fee
    }
    return sum
  }, 0)

  let previousBalance = 0
  if (snapshot) {
    previousBalance = snapshot.previousBalance
  } else if (prevSnapshot) {
    previousBalance = prevSnapshot.totalAmountDue - prevSnapshot.paidAmount
  } else {
    previousBalance = historicalBalance
  }

  const totalAmountDue = previousBalance + currentMonthFee

  const now = new Date()
  const isCurrentMonth =
    now.getFullYear() === year &&
    now.getMonth() + 1 === month

  const needsUpsert =
    !snapshot ||
    (isCurrentMonth && (
      snapshot.totalSessions !== totalSessions ||
      snapshot.presentSessions !== presentSessions ||
      snapshot.currentMonthFee !== currentMonthFee ||
      snapshot.totalAmountDue !== totalAmountDue
    ))

  return { totalSessions, presentSessions, currentMonthFee, previousBalance, totalAmountDue, needsUpsert }
}

export async function getMonthlyTuitionStatus(
  db: PrismaClient,
  userId: number,
  filter: MonthlyTuitionFilterInput
): Promise<PaginatedResponse<TuitionStatusDTO>> {
  const { year, month, grade, search, status, page, limit } = filter

  // 1. Lấy toàn bộ học sinh active theo filter
  const students = await db.student.findMany({
    where: {
      userId,
      isActive: true,
      ...(grade ? { grade } : {}),
      ...(search ? { fullName: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: [{ grade: "asc" }, { fullName: "asc" }],
  })

  if (students.length === 0) return { items: [], totalCount: 0, totalPages: 0 }

  const studentIds = students.map(s => s.id)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  // 2. Fetch song song: điểm danh tháng hiện tại + snapshot tháng này + snapshot tháng trước
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [currentAttendance, existingSnapshots, prevSnapshots] = await Promise.all([
    db.sessionStudent.findMany({
      where: {
        studentId: { in: studentIds },
        session: { sessionDate: { gte: startDate, lt: endDate }, userId },
      },
      include: { session: true },
    }),
    db.monthlyTuition.findMany({
      where: { studentId: { in: studentIds }, year, month },
    }),
    db.monthlyTuition.findMany({
      where: { studentId: { in: studentIds }, year: prevYear, month: prevMonth },
    }),
  ])

  // 3. Dùng Map để tra cứu O(1) thay vì .find() O(n) trong vòng lặp
  const snapshotMap = new Map(existingSnapshots.map(sn => [sn.studentId, sn]))
  const prevSnapshotMap = new Map(prevSnapshots.map(ps => [ps.studentId, ps]))
  const attendanceMap = new Map<number, AttendanceRecord[]>()
  for (const a of currentAttendance) {
    const list = attendanceMap.get(a.studentId) ?? []
    list.push(a)
    attendanceMap.set(a.studentId, list)
  }

  // 4. Học sinh chưa có snapshot nào cả → cần tính lịch sử tồn đọng
  const existingSnapshotIds = new Set(existingSnapshots.map(sn => sn.studentId))
  const prevSnapshotIds = new Set(prevSnapshots.map(ps => ps.studentId))
  const studentsNeedingHistory = students.filter(
    s => !existingSnapshotIds.has(s.id) && !prevSnapshotIds.has(s.id)
  )

  const historicalBalances: Record<number, number> = {}
  if (studentsNeedingHistory.length > 0) {
    const sIds = studentsNeedingHistory.map(s => s.id)
    const [totalPaidBefore, totalExpectedBefore] = await Promise.all([
      db.monthlyTuition.groupBy({
        by: ["studentId"],
        where: {
          studentId: { in: sIds },
          OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
        },
        _sum: { paidAmount: true },
      }),
      db.sessionStudent.groupBy({
        by: ["studentId"],
        where: {
          studentId: { in: sIds },
          session: { sessionDate: { lt: startDate }, userId },
          attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        },
        _sum: { fee: true },
      }),
    ])

    const paidMap = new Map(totalPaidBefore.map(t => [t.studentId, t._sum?.paidAmount ?? 0]))
    const expectedMap = new Map(totalExpectedBefore.map(t => [t.studentId, t._sum?.fee ?? 0]))
    for (const s of studentsNeedingHistory) {
      historicalBalances[s.id] = (expectedMap.get(s.id) ?? 0) - (paidMap.get(s.id) ?? 0)
    }
  }

  // 5. Tính kết quả cho từng học sinh
  const results = students.map(student => {
    const attendance = attendanceMap.get(student.id) ?? []
    const snapshot = snapshotMap.get(student.id)
    const prevSnapshot = prevSnapshotMap.get(student.id)
    const { totalSessions, presentSessions, currentMonthFee, previousBalance, totalAmountDue, needsUpsert } =
      calcStudentTuition(student.id, attendance, snapshot, prevSnapshot, historicalBalances[student.id] ?? 0, year, month)

    return {
      studentId: student.id,
      fullName: student.fullName,
      grade: student.grade,
      totalSessions,
      presentSessions,
      totalExpected: currentMonthFee,
      paidAmount: snapshot?.paidAmount ?? 0,
      isFullPaid: snapshot?.isFullPaid ?? false,
      notes: snapshot?.notes ?? null,
      previousBalance,
      totalAmountDue,
      needsUpsert,
    }
  })

  // 6. Upsert toàn bộ học sinh cần cập nhật (không chỉ trang hiện tại)
  const toUpsert = results.filter(i => i.needsUpsert)
  if (toUpsert.length > 0) {
    await Promise.all(
      toUpsert.map(item =>
        db.monthlyTuition.upsert({
          where: { studentId_year_month: { studentId: item.studentId, year, month } },
          update: {
            totalSessions: item.totalSessions,
            presentSessions: item.presentSessions,
            currentMonthFee: item.totalExpected,
            totalAmountDue: item.totalAmountDue,
            previousBalance: item.previousBalance,
          },
          create: {
            studentId: item.studentId,
            year,
            month,
            totalSessions: item.totalSessions,
            presentSessions: item.presentSessions,
            currentMonthFee: item.totalExpected,
            totalAmountDue: item.totalAmountDue,
            previousBalance: item.previousBalance,
            paidAmount: 0,
            isFullPaid: false,
          },
        })
      )
    )
  }

  // 7. Lọc theo status
  let filteredResults = results
  if (status && status !== "all") {
    filteredResults = results.filter(item => {
      const adjustedAmount = Math.max(0, item.totalAmountDue)
      switch (status) {
        case "fully_paid":
          return item.paidAmount >= adjustedAmount && adjustedAmount > 0
        case "paid_this_month":
          return item.paidAmount >= item.totalExpected && item.totalExpected > 0 && item.previousBalance > 0 && item.paidAmount < adjustedAmount
        case "partial":
          return item.paidAmount > 0 && item.paidAmount < item.totalExpected
        case "unpaid":
          return item.paidAmount === 0 && adjustedAmount > 0
        default:
          return true
      }
    })
  }

  // 8. Phân trang
  const totalCount = filteredResults.length
  const skip = (page - 1) * limit
  const pageItems = filteredResults.slice(skip, skip + limit)

  return {
    items: pageItems.map((item) => ({
      studentId: item.studentId,
      fullName: item.fullName,
      grade: item.grade,
      totalSessions: item.totalSessions,
      presentSessions: item.presentSessions,
      totalExpected: item.totalExpected,
      paidAmount: item.paidAmount,
      isFullPaid: item.isFullPaid,
      notes: item.notes,
      previousBalance: item.previousBalance,
      totalAmountDue: item.totalAmountDue,
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  }
}

export async function updateTuitionPayment(
  db: PrismaClient,
  userId: number,
  input: UpdatePaymentInput
) {
  const { studentId, year, month, paidAmount, isFullPaid, notes } = input

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
