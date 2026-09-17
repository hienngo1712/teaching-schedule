import type { Student, Subject, TeachingSession, SessionStudent } from "@prisma/client"

export type { Student, Subject, TeachingSession, SessionStudent }

/**
 * Common school level derived from grade
 */
export type SchoolLevel = "tieu_hoc" | "thcs"

// Thông tin HS tối thiểu cho màn Báo cáo (không trả userId / phụ huynh).
export type StudentReportInfo = {
  id: number
  fullName: string
  grade: number
  level: SchoolLevel
}

/**
 * Student with enhanced UI fields
 */
export interface StudentDTO extends Omit<Student, "createdAt" | "updatedAt"> {
  level: SchoolLevel
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Subject for UI selection
 */
export interface SubjectDTO extends Pick<Subject, "id" | "name" | "color"> {
  isDefault?: boolean
}

/**
 * Teaching Session basic info for list view
 */
export interface SessionListDTO extends Omit<TeachingSession, "startTime" | "endTime" | "createdAt" | "updatedAt" | "cancelledAt"> {
  startTime: string
  endTime: string
  durationMins: number
  subject: SubjectDTO
  studentCount: number
  level: SchoolLevel | "mixed"
  cancelledAt: Date | string | null
  makeupInfo?: { id: number; sessionDate: Date | string } | null
  originalInfo?: { id: number; sessionDate: Date | string } | null
}

/**
 * Teaching Session with full student details
 */
export interface SessionDTO extends SessionListDTO {
  students: SessionStudentDTO[]
}

/**
 * Student attendance record within a session
 */
export interface SessionStudentDTO extends Omit<SessionStudent, "sessionId" | "studentId"> {
  studentId: number
  fullName: string
  grade: number
}

/**
 * Tuition status for a student in a specific month
 */
export interface TuitionStatusDTO {
  studentId: number
  fullName: string
  grade: number
  totalSessions: number
  presentSessions: number
  totalExpected: number
  paidAmount: number
  isFullPaid: boolean
  notes: string | null
  previousBalance: number
  totalAmountDue: number
}

/**
 * Attendance record for a student
 */
export interface AttendanceDTO {
  studentId: number
  fullName: string
  grade: number
  level: SchoolLevel
  attendance: string
  note: string | null
  fee: number
}
