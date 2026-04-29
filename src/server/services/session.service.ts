import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import {
  calcDurationMinutes,
  formatTime,
  parseTimeToDate,
} from "@/lib/utils"
import { assertOwnership } from "./_base.service"
import type {
  SessionCreateInput,
  SessionFilterInput,
} from "@/lib/schemas/session"

export type SessionDTO = {
  id: number
  userId: number
  sessionDate: Date
  startTime: string
  endTime: string
  durationMins: number
  subjectId: number
  subject: {
    id: number
    name: string
    color: string
  }
  title: string | null
  notes: string | null
  status: string
  studentCount: number
  students: Array<{
    id: number
    studentId: number
    fullName: string
    grade: number
    attendance: string
  }>
}

/**
 * Kiểm tra ca dạy mới có trùng giờ với ca khác trong cùng ngày, cùng user.
 * Dùng raw SQL: start_a < end_b AND end_a > start_b (chuẩn interval overlap).
 */
export async function checkOverlap(
  db: PrismaClient,
  params: {
    userId: number
    sessionDate: Date
    startTime: Date
    endTime: Date
    excludeId?: number
  }
): Promise<void> {
  const { userId, sessionDate, startTime, endTime, excludeId } = params

  const conflicts = await db.$queryRaw<
    Array<{
      id: number
      title: string | null
      start_time: Date
      end_time: Date
    }>
  >(Prisma.sql`
    SELECT id, title, start_time, end_time
    FROM teaching_sessions
    WHERE user_id      = ${userId}
      AND session_date = ${sessionDate}::date
      AND id          != ${excludeId ?? 0}
      AND start_time   < ${endTime}::time
      AND end_time     > ${startTime}::time
    LIMIT 1
  `)

  if (conflicts.length > 0) {
    const c = conflicts[0]
    const label = c.title
      ? `"${c.title}"`
      : `ca ${formatTime(c.start_time)}–${formatTime(c.end_time)}`
    throw new TRPCError({
      code: "CONFLICT",
      message: `Trùng giờ với ${label} đã có trong ngày này`,
    })
  }
}

export function parseSessionDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

type SessionWithRelations = Prisma.TeachingSessionGetPayload<{
  include: {
    subject: true
    sessionStudents: { include: { student: true } }
  }
}>

function toDTO(s: SessionWithRelations): SessionDTO {
  return {
    id: s.id,
    userId: s.userId,
    sessionDate: s.sessionDate,
    startTime: formatTime(s.startTime),
    endTime: formatTime(s.endTime),
    durationMins: calcDurationMinutes(s.startTime, s.endTime),
    subjectId: s.subjectId,
    subject: {
      id: s.subject.id,
      name: s.subject.name,
      color: s.subject.color,
    },
    title: s.title,
    notes: s.notes,
    status: s.status,
    studentCount: s.sessionStudents.length,
    students: s.sessionStudents.map((ss) => ({
      id: ss.id,
      studentId: ss.studentId,
      fullName: ss.student.fullName,
      grade: ss.student.grade,
      attendance: ss.attendance,
    })),
  }
}

export async function getMonthSessions(
  db: PrismaClient,
  userId: number,
  filter: SessionFilterInput
): Promise<SessionDTO[]> {
  const { year, month, grade, studentName } = filter
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  const sessions = await db.teachingSession.findMany({
    where: {
      userId,
      sessionDate: { gte: start, lt: end },
      ...(grade || studentName
        ? {
            sessionStudents: {
              some: {
                student: {
                  ...(grade ? { grade } : {}),
                  ...(studentName
                    ? {
                        fullName: {
                          contains: studentName,
                          mode: "insensitive",
                        },
                      }
                    : {}),
                },
              },
            },
          }
        : {}),
    },
    include: {
      subject: true,
      sessionStudents: { include: { student: true } },
    },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  })

  return sessions.map(toDTO)
}

async function assertSubjectOwned(
  db: PrismaClient,
  userId: number,
  subjectId: number
): Promise<void> {
  const subject = await db.subject.findUnique({ where: { id: subjectId } })
  assertOwnership(subject, userId)
}

export async function createSession(
  db: PrismaClient,
  userId: number,
  input: SessionCreateInput
): Promise<SessionDTO> {
  await assertSubjectOwned(db, userId, input.subjectId)

  const sessionDate = parseSessionDate(input.sessionDate)
  const startTime = parseTimeToDate(input.startTime)
  const endTime = parseTimeToDate(input.endTime)

  await checkOverlap(db, { userId, sessionDate, startTime, endTime })

  // Verify studentIds thuộc userId
  if (input.studentIds && input.studentIds.length > 0) {
    const owned = await db.student.findMany({
      where: { id: { in: input.studentIds }, userId },
      select: { id: true },
    })
    if (owned.length !== input.studentIds.length) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }
  }

  const created = await db.teachingSession.create({
    data: {
      userId,
      sessionDate,
      startTime,
      endTime,
      subjectId: input.subjectId,
      title: input.title ?? null,
      notes: input.notes ?? null,
      ...(input.studentIds && input.studentIds.length > 0
        ? {
            sessionStudents: {
              create: input.studentIds.map((sid) => ({ studentId: sid })),
            },
          }
        : {}),
    },
    include: {
      subject: true,
      sessionStudents: { include: { student: true } },
    },
  })
  return toDTO(created)
}

export type SessionUpdateData = {
  sessionDate?: string
  startTime?: string
  endTime?: string
  subjectId?: number
  title?: string
  notes?: string
}

export async function updateSession(
  db: PrismaClient,
  userId: number,
  id: number,
  data: SessionUpdateData
): Promise<SessionDTO> {
  const existing = await db.teachingSession.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  if (data.subjectId !== undefined) {
    await assertSubjectOwned(db, userId, data.subjectId)
  }

  const newSessionDate = data.sessionDate
    ? parseSessionDate(data.sessionDate)
    : existing.sessionDate
  const newStart = data.startTime
    ? parseTimeToDate(data.startTime)
    : existing.startTime
  const newEnd = data.endTime
    ? parseTimeToDate(data.endTime)
    : existing.endTime

  // Chỉ check overlap khi giờ/ngày thay đổi
  if (
    data.sessionDate !== undefined ||
    data.startTime !== undefined ||
    data.endTime !== undefined
  ) {
    await checkOverlap(db, {
      userId,
      sessionDate: newSessionDate,
      startTime: newStart,
      endTime: newEnd,
      excludeId: id,
    })
  }

  const updated = await db.teachingSession.update({
    where: { id },
    data: {
      ...(data.sessionDate !== undefined && { sessionDate: newSessionDate }),
      ...(data.startTime !== undefined && { startTime: newStart }),
      ...(data.endTime !== undefined && { endTime: newEnd }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: {
      subject: true,
      sessionStudents: { include: { student: true } },
    },
  })
  return toDTO(updated)
}

export async function deleteSession(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<{ success: true }> {
  const existing = await db.teachingSession.findUnique({ where: { id } })
  assertOwnership(existing, userId)
  await db.teachingSession.delete({ where: { id } })
  return { success: true }
}

export { parseTimeToDate }
