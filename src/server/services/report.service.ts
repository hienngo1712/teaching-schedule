import { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { calcAttendanceRate } from "@/lib/utils"
import { assertOwnership } from "./_base.service"
import { getMonthSessions } from "./session.service"

export async function getStudentReport(
  db: PrismaClient,
  userId: number,
  params: {
    studentId: number
    year: number
    month: number
  }
) {
  const { studentId, year, month } = params

  // Verify student ownership
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)

  // Fetch sessions for this student in the period
  const sessions = await getMonthSessions(db, userId, {
    year,
    month,
    studentId,
    includeStudents: true,
  })

  // Calculate summary
  const studentSessions = sessions.filter(s => s.students.some(st => st.studentId === studentId))
  const total = studentSessions.length
  const present = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.PRESENT).length
  const absent = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.ABSENT).length
  const late = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.LATE).length
  const pending = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.PENDING).length

  const rate = calcAttendanceRate(present + late, total - pending)

  let totalRevenue = 0
  studentSessions.forEach(s => {
    const ss = s.students.find(x => x.studentId === studentId)
    if (ss && (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE)) {
      totalRevenue += ss.fee
    }
  })

  return {
    student,
    sessions: studentSessions,
    summary: { total, present, absent, late, pending, rate, totalRevenue }
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

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = toYear && toMonth
    ? new Date(Date.UTC(toYear, toMonth, 1))
    : new Date(Date.UTC(year, month, 1))

  // Historical filter: when `grade` is set, scope `students` and `monthlyTuitions`
  // by sessionStudent.grade WITHIN the report period — so past months keep
  // showing students by the grade they attended as, not by their current grade.
  const studentsWhere = grade
    ? {
        userId,
        sessionStudents: {
          some: {
            grade,
            session: { sessionDate: { gte: startDate, lt: endDate } },
          },
        },
      }
    : { userId, isActive: true }

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
        year: { gte: year, lte: toYear ?? year },
      }
    : {
        student: { userId },
        year: { gte: year, lte: toYear ?? year },
      }

  const [sessions, students, monthlyTuitions] = await Promise.all([
    db.teachingSession.findMany({
      where: {
        userId,
        sessionDate: { gte: startDate, lt: endDate },
        ...(grade ? { sessionStudents: { some: { grade } } } : {})
      },
      include: {
        sessionStudents: { include: { student: true } }
      }
    }),
    db.student.findMany({ where: studentsWhere }),
    db.monthlyTuition.findMany({ where: monthlyTuitionsWhere })
  ])

  const totalSessions = sessions.length
  const totalStudents = students.length

  // By Grade
  const byGrade = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => {
    const gradeSessions = sessions.filter(s => s.sessionStudents.some(st => st.grade === g))
    const gradeStudentIds = new Set<number>()
    for (const s of sessions) {
      for (const st of s.sessionStudents) {
        if (st.grade === g) gradeStudentIds.add(st.studentId)
      }
    }
    return {
      grade: g,
      sessionCount: gradeSessions.length,
      studentCount: gradeStudentIds.size,
    }
  })

  let totalRevenue = 0
  let presentRecords = 0
  let totalRecords = 0

  sessions.forEach(s => {
    s.sessionStudents.forEach(ss => {
      if (grade && ss.grade !== grade) return
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
  const endVal = (toYear ?? year) * 100 + (toMonth ?? month)
  
  const totalPaid = monthlyTuitions
    .filter(t => {
      const v = t.year * 100 + t.month
      return v >= startVal && v <= endVal
    })
    .reduce((sum, t) => sum + t.paidAmount, 0)

  const overallAttendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0

  return {
    totalSessions,
    totalStudents,
    totalRevenue,
    totalPaid,
    byGrade,
    overallAttendanceRate: Math.round(overallAttendanceRate * 10) / 10
  }
}

export async function getDashboardStats(db: PrismaClient, userId: number) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))

  // Chạy các query song song để giảm latency tổng (đặc biệt quan trọng với serverless DB)
  const [totalStudents, sessionsToday, sessionsThisMonth, userMonthlyTuitions] = await Promise.all([
    // 1. Total active students
    db.student.count({ where: { userId, isActive: true } }),

    // 2. Sessions today
    db.teachingSession.count({
      where: { userId, sessionDate: today }
    }),

    // 3. This month's sessions
    db.teachingSession.findMany({
      where: { userId, sessionDate: { gte: startOfMonth, lt: endOfMonth } },
      include: { sessionStudents: true }
    }),

    // 5. Total unpaid tuition this month
    db.monthlyTuition.findMany({
      where: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        student: { userId },
      },
    })
  ])

  const totalSessionsMonth = sessionsThisMonth.length

  // 4. Attendance rate and revenue this month
  let totalRecords = 0
  let presentRecords = 0
  let totalRevenueMonth = 0

  sessionsThisMonth.forEach(s => {
    s.sessionStudents.forEach(ss => {
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
  
  const paidThisMonth = userMonthlyTuitions.reduce((sum, t) => sum + t.paidAmount, 0)
  const totalUnpaidMonth = Math.max(0, totalRevenueMonth - paidThisMonth)

  return {
    totalStudents,
    sessionsToday,
    totalSessionsMonth,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    totalRevenueMonth,
    totalUnpaidMonth,
  }
}
