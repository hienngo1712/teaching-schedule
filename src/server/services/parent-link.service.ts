import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { assertOwnership } from "./_base.service"
import { getTuitionNotice } from "./tuition-notice.service"
import { formatTime, vnDateParts } from "@/lib/utils"
import { effectivePlan, hasFeature } from "@/lib/plans"
import type { ParentSessionDTO, ParentViewDTO } from "@/lib/types/models"

// 32 byte base64url = 43 ký tự. Kiểm dạng trước khi truy vấn để token rác không chạm DB.
export const PARENT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/

async function assertStudentOwned(db: PrismaClient, userId: number, studentId: number) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  })
  assertOwnership(student, userId)
}

export async function generateParentLink(
  db: PrismaClient,
  userId: number,
  studentId: number
): Promise<{ token: string }> {
  await assertStudentOwned(db, userId, studentId)
  // Ghi đè token = link cũ chết ngay. Trùng unique gần như không thể nên chỉ thử lại 1 lần.
  for (let attempt = 0; ; attempt++) {
    const token = randomBytes(32).toString("base64url")
    try {
      await db.student.update({ where: { id: studentId }, data: { parentLinkToken: token } })
      return { token }
    } catch (e) {
      const isDuplicate =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
      if (!isDuplicate || attempt > 0) throw e
    }
  }
}

export async function disableParentLink(
  db: PrismaClient,
  userId: number,
  studentId: number
): Promise<{ success: true }> {
  await assertStudentOwned(db, userId, studentId)
  await db.student.update({ where: { id: studentId }, data: { parentLinkToken: null } })
  return { success: true }
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_MONTHS_BACK = 11
const UPCOMING_LIMIT = 10

const toMonthIndex = (year: number, month: number) => year * 12 + (month - 1)
const toYm = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`

const SESSION_SELECT = {
  attendance: true,
  session: {
    select: {
      sessionDate: true,
      startTime: true,
      endTime: true,
      subject: { select: { name: true } },
    },
  },
} satisfies Prisma.SessionStudentSelect

const SESSION_ORDER = [
  { session: { sessionDate: "asc" } },
  { session: { startTime: "asc" } },
] satisfies Prisma.SessionStudentOrderByWithRelationInput[]

type SessionRow = Prisma.SessionStudentGetPayload<{ select: typeof SESSION_SELECT }>

function toSessionDTO(row: SessionRow): ParentSessionDTO {
  return {
    date: row.session.sessionDate.toISOString().slice(0, 10),
    startTime: formatTime(row.session.startTime),
    endTime: formatTime(row.session.endTime),
    subjectName: row.session.subject.name,
    attendance: row.attendance as ParentSessionDTO["attendance"],
  }
}

// Chỉ đọc: trang công khai không được ghi gì vào DB (kể cả snapshot học phí).
export async function getParentView(
  db: PrismaClient,
  token: string,
  thang?: string
): Promise<ParentViewDTO | null> {
  if (!PARENT_TOKEN_REGEX.test(token)) return null

  const student = await db.student.findUnique({
    where: { parentLinkToken: token },
    select: {
      id: true,
      userId: true,
      fullName: true,
      grade: true,
      createdAt: true,
      user: { select: { isActive: true, fullName: true, plan: true, planExpiresAt: true, trialEndsAt: true } },
    },
  })
  if (!student || !student.user.isActive) return null
  // D9: chủ TK hết Pro thì link tạm 404 như token sai; token giữ nguyên để gia hạn là sống lại.
  if (!hasFeature(effectivePlan(student.user, new Date()).plan, "parentLink")) return null

  const now = vnDateParts()
  const maxIdx = toMonthIndex(now.year, now.month)
  const created = vnDateParts(student.createdAt)
  const minIdx = Math.max(maxIdx - MAX_MONTHS_BACK, toMonthIndex(created.year, created.month))
  let idx = maxIdx
  if (thang && MONTH_REGEX.test(thang)) {
    const [y, m] = thang.split("-").map(Number)
    const wanted = toMonthIndex(y, m)
    if (wanted >= minIdx && wanted <= maxIdx) idx = wanted
  }
  const year = Math.floor(idx / 12)
  const month = (idx % 12) + 1

  const notice = await getTuitionNotice(db, student.userId, { studentId: student.id, year, month })

  // Cùng điều kiện với currentAttendance trong getMonthlyTuitionStatus để số buổi khớp phiếu.
  const where = (sessionDate: Prisma.DateTimeFilter) => ({
    studentId: student.id,
    session: { userId: student.userId, sessionDate, status: { not: "cancelled" as const } },
  })
  const [monthRows, upcomingRows] = await Promise.all([
    db.sessionStudent.findMany({
      where: where({
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      }),
      select: SESSION_SELECT,
      orderBy: SESSION_ORDER,
    }),
    db.sessionStudent.findMany({
      where: where({ gte: new Date(Date.UTC(now.year, now.month - 1, now.day)) }),
      select: SESSION_SELECT,
      orderBy: SESSION_ORDER,
      take: UPCOMING_LIMIT,
    }),
  ])

  return {
    student: { fullName: student.fullName, grade: student.grade },
    year,
    month,
    prevMonth: idx > minIdx ? toYm(idx - 1) : null,
    nextMonth: idx < maxIdx ? toYm(idx + 1) : null,
    notice: {
      ...notice,
      // studentId là id tự tăng nội bộ, không được lộ ra trang công khai.
      studentId: 0,
      // C lấy username khi thiếu họ tên: không được lộ tên đăng nhập ra trang công khai.
      teacherName: student.user.fullName || "Giáo viên",
      // Ghi chú lần thu là của giáo viên; payment.id là id nội bộ → thay bằng chỉ số (card chỉ dùng làm React key).
      payments: notice.payments.map((p, i) => ({ ...p, id: i, note: null })),
    },
    attendance: monthRows.map(toSessionDTO),
    upcoming: upcomingRows.map(toSessionDTO),
  }
}
