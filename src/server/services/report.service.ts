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
  // We can reuse getMonthSessions by filtering for this student
  const sessions = await getMonthSessions(db, userId, {
    year,
    month,
    studentName: student!.fullName // This is a bit loose, better to filter by studentId if getMonthSessions supports it
  })

  // Calculate summary
  const studentSessions = sessions.filter(s => s.students.some(st => st.studentId === studentId))
  const total = studentSessions.length
  const present = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.PRESENT).length
  const absent = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.ABSENT).length
  const late = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.LATE).length
  const pending = studentSessions.filter(s => s.students.find(ss => ss.studentId === studentId)?.attendance === ATTENDANCE_STATUS.PENDING).length

  const rate = calcAttendanceRate(present + late, total - pending)

  return {
    student,
    sessions: studentSessions,
    summary: { total, present, absent, late, pending, rate }
  }
}

export async function getMonthlySummary(
  db: PrismaClient,
  userId: number,
  params: { year: number; month: number }
) {
  const { year, month } = params
  
  const sessions = await getMonthSessions(db, userId, { year, month })
  
  const totalSessions = sessions.length
  const students = await db.student.findMany({ where: { userId, isActive: true } })
  const totalStudents = students.length

  // By Grade
  const byGrade = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(grade => {
    const gradeSessions = sessions.filter(s => s.students.some(st => st.grade === grade))
    return {
      grade,
      sessionCount: gradeSessions.length,
      studentCount: students.filter(s => s.grade === grade).length
    }
  })

  return {
    totalSessions,
    totalStudents,
    byGrade,
    overallAttendanceRate: 0 // Placeholder
  }
}

export async function getDashboardStats(db: PrismaClient, userId: number) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  // 1. Total active students
  const totalStudents = await db.student.count({ where: { userId, isActive: true } })

  // 2. Sessions today
  const sessionsToday = await db.teachingSession.count({
    where: { userId, sessionDate: today }
  })

  // 3. This month's sessions
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))

  const sessionsThisMonth = await db.teachingSession.findMany({
    where: { userId, sessionDate: { gte: startOfMonth, lt: endOfMonth } },
    include: { sessionStudents: true }
  })

  const totalSessionsMonth = sessionsThisMonth.length

  // 4. Attendance rate this month
  let totalRecords = 0
  let presentRecords = 0

  sessionsThisMonth.forEach(s => {
    s.sessionStudents.forEach(ss => {
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
        }
      }
    })
  })

  const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0

  return {
    totalStudents,
    sessionsToday,
    totalSessionsMonth,
    attendanceRate: Math.round(attendanceRate * 10) / 10
  }
}
