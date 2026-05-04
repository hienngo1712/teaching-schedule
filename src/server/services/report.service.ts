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
