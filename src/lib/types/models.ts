import type { Student, Subject, TeachingSession, SessionStudent } from "@prisma/client"
import type { PaymentMethod } from "@/lib/schemas/payment"

export type { Student, Subject, TeachingSession, SessionStudent }

/**
 * Common school level derived from grade
 */
export type SchoolLevel = "tieu_hoc" | "thcs" | "thpt"

// Thông tin HS tối thiểu cho màn Báo cáo (không trả userId / phụ huynh).
export type StudentReportInfo = {
  id: number
  fullName: string
  grade: number
  level: SchoolLevel
}

import type { BillingMode } from "@/lib/billing"

/**
 * Student with enhanced UI fields
 */
export interface StudentDTO extends Omit<Student, "createdAt" | "updatedAt" | "deletedAt" | "purgedAt" | "parentLinkTokenHash" | "billingMode"> {
  billingMode: BillingMode
  level: SchoolLevel
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
  purgedAt?: Date | string | null
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
export interface SessionListDTO extends Omit<TeachingSession, "startTime" | "endTime" | "createdAt" | "updatedAt" | "cancelledAt" | "deletedAt"> {
  startTime: string
  endTime: string
  durationMins: number
  subject: SubjectDTO
  studentCount: number
  grades: number[]
  level: SchoolLevel | "mixed"
  cancelledAt: Date | string | null
  deletedAt: Date | string | null
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
  billingMode?: BillingMode
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
  billingMode: BillingMode
  monthlyFee: number
  noticeSentAt: Date | string | null
  noticeSentAmount: number | null
  noticeStatus: NoticeStatus
}

export type NoticeStatus = "none" | "sent" | "changed"

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
  billingMode?: BillingMode
}

/**
 * Một lần thu tiền của 1 tháng học phí (spec B §11). paidAt dạng "YYYY-MM-DD".
 */
export interface PaymentDTO {
  id: number
  amount: number
  paidAt: string
  method: PaymentMethod
  note: string | null
}

export type PaymentBatchDTO = {
  batchId: string
  amount: number
  paidAt: string
  note: string | null
  allocations: { year: number; month: number; amount: number }[]
  legacy: boolean
}

/**
 * Phiếu báo học phí 1 HS/tháng (spec C §7.4). G dùng lại y nguyên.
 */
export interface TuitionNoticeDTO {
  studentId: number
  fullName: string
  grade: number
  year: number
  month: number
  totalSessions: number
  presentSessions: number
  billingMode: BillingMode
  monthlyFee: number
  currentMonthFee: number
  previousBalance: number
  totalAmountDue: number
  paidAmount: number
  isFullPaid: boolean
  presentDates: { date: string; fee: number }[]
  payments: PaymentDTO[]
  remaining: number
  overpaid: number
  teacherName: string
  bankConfigured: boolean
  qr: {
    payload: string
    bankShortName: string
    accountNumber: string
    accountName: string
    amount: number
    content: string
  } | null
}

// Trang phụ huynh công khai: chỉ liệt kê trường được phép lộ, không extends type Prisma.
export type ParentSessionDTO = {
  date: string // "YYYY-MM-DD"
  startTime: string // "HH:mm"
  endTime: string
  subjectName: string
  attendance: "pending" | "present" | "absent" | "late"
}

export type ParentViewDTO = {
  student: { fullName: string; grade: number }
  year: number
  month: number
  prevMonth: string | null // "YYYY-MM", null ở biên
  nextMonth: string | null
  notice: TuitionNoticeDTO // payments[].note luôn null
  attendance: ParentSessionDTO[]
  upcoming: ParentSessionDTO[]
}

export type TrashItemDTO =
  | { type: "session"; id: number; deletedAt: Date | string; sessionDate: string; startTime: string; endTime: string; subjectName: string; title: string | null; isMakeup: boolean }
  | { type: "student"; id: number; deletedAt: Date | string; fullName: string; grade: number }
  | { type: "payment"; id: number; deletedAt: Date | string; amount: number; paidAt: string; studentName: string; year: number; month: number }
  | { type: "subject"; id: number; deletedAt: Date | string; name: string; color: string }
