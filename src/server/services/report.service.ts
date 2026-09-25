import { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { calcAttendanceRate, getLevel, vnDateParts } from "@/lib/utils"
import { assertOwnership } from "./_base.service"
import { getMonthSessions } from "./session.service"
import { getMonthlyOutstanding } from "./tuition.service"

export async function getStudentReport(
  db: PrismaClient,
  userId: number,
  params: {
    studentId: number
    year: number
    month: number
    toYear?: number
    toMonth?: number
  }
) {
  const { studentId, year, month, toYear, toMonth } = params

  // Verify student ownership
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)

  // Như getMonthlySummary: cho phép truyền toMonth mà không kèm toYear (và
  // ngược lại). getMonthSessions chỉ mở rộng khoảng khi có ĐỦ cả hai mốc, nên
  // điền nốt mốc còn thiếu từ kỳ bắt đầu.
  const hasRange = toYear !== undefined || toMonth !== undefined

  // Fetch sessions for this student in the period
  const sessions = await getMonthSessions(db, userId, {
    year,
    month,
    toYear: hasRange ? (toYear ?? year) : undefined,
    toMonth: hasRange ? (toMonth ?? month) : undefined,
    studentId,
    includeStudents: true,
  })

  // Calculate summary
  const studentSessions = sessions
    .filter(s => s.status !== "cancelled")
    .filter(s => s.students.some(st => st.studentId === studentId))
  const total = studentSessions.length
  const present = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.PRESENT).length
  const absent = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.ABSENT).length
  const late = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.LATE).length
  const pending = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.PENDING).length

  const rate = calcAttendanceRate(present + late, total - pending)

  let totalRevenue = 0
  let expectedRevenue = 0
  studentSessions.forEach(s => {
    const ss = s.students.find(x => x.studentId === studentId)
    if (ss) {
      expectedRevenue += ss.fee
      if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
        totalRevenue += ss.fee
      }
    }
  })

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      grade: student.grade,
      level: getLevel(student.grade),
    },
    sessions: studentSessions,
    summary: { total, present, absent, late, pending, rate, totalRevenue, expectedRevenue }
  }
}

export async function getMonthlySummary(
  db: PrismaClient,
  userId: number,
  params: {
    year: number;
    month: number;
    toYear?: number;
    toMonth?: number;
    grade?: number;
  }
) {
  const { year, month, toYear, toMonth, grade } = params

  // Mốc cuối kỳ hiệu dụng: cho phép truyền toMonth mà không kèm toYear (và ngược
  // lại). Tính nhất quán cho startDate/endDate, bộ lọc năm và totalPaid bên dưới
  // để doanh thu & tiền đã thu luôn cùng một khoảng thời gian.
  const effToYear = toYear ?? year
  const effToMonth = toMonth ?? month

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(effToYear, effToMonth, 1))

  // Historical filter: when `grade` is set, scope `monthlyTuitions` by
  // sessionStudent.grade WITHIN the report period — so past months keep
  // showing students by the grade they attended as, not by their current grade.
  const monthlyTuitionsWhere = grade
    ? {
        student: {
          userId,
          sessionStudents: {
            some: {
              grade,
              session: { sessionDate: { gte: startDate, lt: endDate } },
            },
          },
        },
        year: { gte: year, lte: effToYear },
      }
    : {
        student: { userId },
        year: { gte: year, lte: effToYear },
      }

  const [sessions, monthlyTuitions] = await Promise.all([
    db.teachingSession.findMany({
      where: {
        userId,
        sessionDate: { gte: startDate, lt: endDate },
        status: { not: "cancelled" },
        ...(grade ? { sessionStudents: { some: { grade } } } : {})
      },
      include: {
        sessionStudents: { include: { student: true } }
      }
    }),
    db.monthlyTuition.findMany({ where: monthlyTuitionsWhere })
  ])

  const totalSessions = sessions.length

  // Headcount = distinct students actually taught in the period (snapshot
  // grade-aware), so it ties out with revenue below and includes
  // students who have since graduated / gone inactive.
  const studentIdsInPeriod = new Set<number>()
  for (const s of sessions) {
    for (const ss of s.sessionStudents) {
      if (grade && ss.grade !== grade) continue
      studentIdsInPeriod.add(ss.studentId)
    }
  }
  const totalStudents = studentIdsInPeriod.size

  let totalRevenue = 0
  let expectedRevenue = 0
  let presentRecords = 0
  let totalRecords = 0

  sessions.forEach(s => {
    s.sessionStudents.forEach(ss => {
      if (grade && ss.grade !== grade) return
      expectedRevenue += ss.fee
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
          totalRevenue += ss.fee
        }
      }
    })
  })

  const startVal = year * 100 + month
  const endVal = effToYear * 100 + effToMonth

  // Khi lọc theo grade: paidAmount (theo tháng, không lưu grade) chỉ được tính cho
  // những tháng HS thực sự học đúng khối đó — đối chiếu qua snapshot grade của buổi.
  // Tránh cộng nhầm tiền sang khối khác khi HS đổi khối giữa kỳ.
  const gradeMonthKeys = grade ? new Set<string>() : null
  if (gradeMonthKeys) {
    for (const s of sessions) {
      const y = s.sessionDate.getUTCFullYear()
      const m = s.sessionDate.getUTCMonth() + 1
      for (const ss of s.sessionStudents) {
        if (ss.grade === grade) gradeMonthKeys.add(`${ss.studentId}-${y}-${m}`)
      }
    }
  }

  const totalPaid = monthlyTuitions
    .filter(t => {
      const v = t.year * 100 + t.month
      if (v < startVal || v > endVal) return false
      if (gradeMonthKeys && !gradeMonthKeys.has(`${t.studentId}-${t.year}-${t.month}`)) return false
      return true
    })
    .reduce((sum, t) => sum + t.paidAmount, 0)

  const overallAttendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0

  // Outstanding (còn nợ) must match the tuition page: per-student carry-over,
  // netted per student. Computed at the END month of the period.
  const { totalOutstanding } = await getMonthlyOutstanding(db, userId, {
    year: effToYear,
    month: effToMonth,
    grade,
  })

  return {
    totalSessions,
    totalStudents,
    totalRevenue,
    expectedRevenue,
    totalPaid,
    totalOutstanding,
    overallAttendanceRate: Math.round(overallAttendanceRate * 10) / 10
  }
}

export async function getDashboardStats(db: PrismaClient, userId: number) {
  // Mốc thời gian theo lịch VN, không theo giờ local của process (server chạy UTC).
  const { year: vnYear, month: vnMonth, day: vnDay } = vnDateParts()
  const today = new Date(Date.UTC(vnYear, vnMonth - 1, vnDay))
  const startOfMonth = new Date(Date.UTC(vnYear, vnMonth - 1, 1))
  const endOfMonth = new Date(Date.UTC(vnYear, vnMonth, 1))

  // Chạy các query song song để giảm latency tổng (đặc biệt quan trọng với serverless DB)
  const [totalStudents, sessionsToday, sessionsThisMonth, outstanding, paidAgg] = await Promise.all([
    // 1. Total active students
    db.student.count({ where: { userId, isActive: true } }),

    // 2. Sessions today
    db.teachingSession.count({
      where: { userId, sessionDate: today, status: { not: "cancelled" } }
    }),

    // 3. This month's sessions
    db.teachingSession.findMany({
      where: { userId, sessionDate: { gte: startOfMonth, lt: endOfMonth }, status: { not: "cancelled" } },
      include: { sessionStudents: true }
    }),

    // 5. Outstanding tuition — same per-student carry-over math as the tuition page
    getMonthlyOutstanding(db, userId, {
      year: vnYear,
      month: vnMonth,
    }),

    // Tiền đã ghi nhận trong tháng — cùng nguồn monthlyTuition.paidAmount với Báo cáo
    db.monthlyTuition.aggregate({
      where: { student: { userId }, year: vnYear, month: vnMonth },
      _sum: { paidAmount: true },
    }),
  ])

  const totalSessionsMonth = sessionsThisMonth.length

  // 4. Attendance rate and revenue this month
  let totalRecords = 0
  let presentRecords = 0
  let totalRevenueMonth = 0
  let expectedRevenueMonth = 0

  sessionsThisMonth.forEach(s => {
    s.sessionStudents.forEach(ss => {
      expectedRevenueMonth += ss.fee
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
          totalRevenueMonth += ss.fee
        }
      }
    })
  })

  const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0

  const totalUnpaidMonth = outstanding.totalOutstanding

  return {
    totalStudents,
    sessionsToday,
    totalSessionsMonth,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    totalRevenueMonth,
    expectedRevenueMonth,
    totalUnpaidMonth,
    totalPaidMonth: paidAgg._sum.paidAmount ?? 0,
  }
}
