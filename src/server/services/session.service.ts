import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import dayjs from "dayjs"
import {
  calcDurationMinutes,
  formatTime,
  getLevel,
  parseTimeToDate,
} from "@/lib/utils"
import { assertOwnership } from "./_base.service"
import {
  type SessionBulkCreateInput,
  type SessionCreateInput,
  type SessionFilterInput,
} from "@/lib/schemas/session"
import type { SessionDTO } from "@/lib/types/models"

/**
 * Kiểm tra ca dạy mới có trùng giờ với ca khác trong cùng ngày, cùng user.
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

type SessionWithSubjectAndStudents = Prisma.TeachingSessionGetPayload<{
  include: {
    subject: true
    sessionStudents: { include: { student: true } }
  }
}> & {
  _count?: { sessionStudents: number }
}

function deriveLevel(students: Array<{ grade: number }>): "tieu_hoc" | "thcs" | "mixed" {
  const levels = students.filter(st => st.grade > 0).map(st => getLevel(st.grade))
  if (levels.length === 0) return "tieu_hoc"
  if (levels.every(l => l === "tieu_hoc")) return "tieu_hoc"
  if (levels.every(l => l === "thcs")) return "thcs"
  return "mixed"
}

function toDTO(s: SessionWithSubjectAndStudents): SessionDTO {
  const students = s.sessionStudents?.map((ss) => ({
    id: ss.id,
    studentId: ss.studentId,
    fullName: ss.student?.fullName || "",
    grade: ss.grade,
    attendance: ss.attendance,
    note: ss.note,
    fee: ss.fee,
  })) ?? []

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
    studentCount: s._count?.sessionStudents ?? s.sessionStudents?.length ?? 0,
    level: deriveLevel(students),
    students,
  }
}

export async function getMonthSessions(
  db: PrismaClient,
  userId: number,
  filter: SessionFilterInput
): Promise<SessionDTO[]> {
  const { year, month, toYear, toMonth, grade, studentName, studentId, includeStudents } = filter
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = toYear && toMonth 
    ? new Date(Date.UTC(toYear, toMonth, 1))
    : new Date(Date.UTC(year, month, 1))

  const sessions = await db.teachingSession.findMany({
    where: {
      userId,
      sessionDate: { gte: start, lt: end },
      ...(grade || studentName || studentId
        ? {
            sessionStudents: {
              some: {
                ...(grade ? { grade } : {}),
                ...(studentId || studentName
                  ? {
                      student: {
                        ...(studentId ? { id: studentId } : {}),
                        ...(studentName
                          ? { fullName: { contains: studentName, mode: "insensitive" as const } }
                          : {}),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    },
    include: {
      subject: true,
      ...(includeStudents
        ? { sessionStudents: { include: { student: true }, orderBy: { student: { fullName: 'asc' } } } }
        : { sessionStudents: { select: { id: true, studentId: true, grade: true, attendance: true, note: true, fee: true } } }
      ),
      _count: { select: { sessionStudents: true } },
    },

    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  })

  return sessions.map(s => toDTO(s as SessionWithSubjectAndStudents))
}

export async function getSessionDetail(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<SessionDTO> {
  const session = await db.teachingSession.findUnique({
    where: { id },
    include: {
      subject: true,
      sessionStudents: {
        include: { student: true },
        orderBy: { student: { fullName: "asc" } },
      },
      _count: { select: { sessionStudents: true } },
    },
  })

  assertOwnership(session, userId)

  return toDTO(session as SessionWithSubjectAndStudents)
}

async function assertSubjectOwned(
  db: PrismaClient,
  userId: number,
  subjectId: number
): Promise<void> {
  const subject = await db.subject.findUnique({ where: { id: subjectId } })
  assertOwnership(subject, userId)
}

async function assertStudentsOwned(
  db: PrismaClient,
  userId: number,
  studentIds: number[]
): Promise<Array<{ id: number; tuitionFee: number; grade: number }>> {
  if (!studentIds.length) return []
  const owned = await db.student.findMany({
    where: { id: { in: studentIds }, userId },
    select: { id: true, tuitionFee: true, grade: true },
  })
  if (owned.length !== studentIds.length) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return owned
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

  let studentFees: Array<{ id: number; tuitionFee: number; grade: number }> = []
  if (input.studentIds) {
    studentFees = await assertStudentsOwned(db, userId, input.studentIds)
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
      ...(studentFees.length > 0
        ? {
            sessionStudents: {
              create: studentFees.map((s) => ({
                studentId: s.id,
                fee: s.tuitionFee,
                grade: s.grade,
              })),
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
  studentIds?: number[]
}

/**
 * Đồng bộ danh sách HS của một ca theo kiểu delta: chỉ xóa HS bị bỏ, chỉ thêm HS
 * mới — GIỮ NGUYÊN điểm danh/ghi chú/học phí của HS đã có. Tránh kiểu xóa-sạch-tạo-lại
 * làm reset toàn bộ trạng thái điểm danh khi chỉ thay đổi 1 HS.
 */
async function syncSessionStudents(
  tx: Prisma.TransactionClient,
  sessionId: number,
  studentFees: Array<{ id: number; tuitionFee: number; grade: number }>
): Promise<void> {
  const current = await tx.sessionStudent.findMany({
    where: { sessionId },
    select: { studentId: true },
  })
  const currentIds = new Set(current.map((c) => c.studentId))
  const targetIds = new Set(studentFees.map((s) => s.id))

  const toRemove = Array.from(currentIds).filter((sid) => !targetIds.has(sid))
  if (toRemove.length > 0) {
    await tx.sessionStudent.deleteMany({
      where: { sessionId, studentId: { in: toRemove } },
    })
  }

  const toAdd = studentFees.filter((s) => !currentIds.has(s.id))
  if (toAdd.length > 0) {
    await tx.sessionStudent.createMany({
      data: toAdd.map((s) => ({
        sessionId,
        studentId: s.id,
        fee: s.tuitionFee,
        grade: s.grade,
      })),
    })
  }
}

export async function updateSession(
  db: PrismaClient,
  userId: number,
  id: number,
  data: SessionUpdateData
): Promise<SessionDTO> {
  const existing = await db.teachingSession.findUnique({
    where: { id },
    include: { sessionStudents: true },
  })
  assertOwnership(existing, userId)

  if (data.subjectId !== undefined) {
    await assertSubjectOwned(db, userId, data.subjectId)
  }

  // Verify studentIds thuộc userId và lấy học phí
  let studentFees: Array<{ id: number; tuitionFee: number; grade: number }> = []
  if (data.studentIds !== undefined && data.studentIds.length > 0) {
    studentFees = await assertStudentsOwned(db, userId, data.studentIds)
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

  if (newEnd <= newStart) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Giờ kết thúc phải sau giờ bắt đầu",
    })
  }

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

  // Cập nhật session và sync học sinh
  const updated = await db.$transaction(async (tx) => {
    // Nếu có truyền studentIds, đồng bộ delta (giữ điểm danh HS còn lại).
    // studentIds: [] CHỦ ĐÍCH = gỡ hết HS (form sửa ca luôn gửi đúng roster hiện
    // tại nên [] chỉ xảy ra khi user bỏ chọn hết). Đừng chặn ở đây — nếu cần
    // tránh lỡ tay, thêm dialog xác nhận ở UI.
    if (data.studentIds !== undefined) {
      await syncSessionStudents(tx, id, studentFees)
    }

    return await tx.teachingSession.update({
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
  })

  return toDTO(updated)
}

export async function addStudentsToRecurringSessions(
  db: PrismaClient,
  userId: number,
  params: {
    studentIds: number[]
    startTime: string // "HH:mm"
    endTime: string // "HH:mm"
    startDate: string // "YYYY-MM-DD"
    endDate: string // "YYYY-MM-DD"
    weekdays: number[] // 0=T2...6=CN
  }
): Promise<{ updatedSessions: number }> {
  const start = parseSessionDate(params.startDate)
  const end = parseSessionDate(params.endDate)
  const startTime = parseTimeToDate(params.startTime)
  const endTime = parseTimeToDate(params.endTime)

  // 1. Tìm tất cả các ca dạy khớp giờ + trong khoảng ngày
  const sessions = await db.teachingSession.findMany({
    where: {
      userId,
      sessionDate: { gte: start, lte: end },
      startTime,
      endTime,
    },
    select: { id: true, sessionDate: true },
  })

  // 2. Lọc theo weekdays
  const matchingSessionIds = sessions
    .filter((s) => {
      const VN_dayIndex = (new Date(s.sessionDate).getUTCDay() + 6) % 7
      return params.weekdays.includes(VN_dayIndex)
    })
    .map((s) => s.id)

  if (matchingSessionIds.length === 0) {
    return { updatedSessions: 0 }
  }

  // 3. Verify students and get fees
  const owned = await assertStudentsOwned(db, userId, params.studentIds)

  // 4. Batch find existing records to skip
  const existing = await db.sessionStudent.findMany({
    where: {
      sessionId: { in: matchingSessionIds },
      studentId: { in: params.studentIds },
    },
    select: { sessionId: true, studentId: true },
  })

  const existingMap = new Set(existing.map((e) => `${e.sessionId}-${e.studentId}`))

  const toCreate: Array<{ sessionId: number; studentId: number; fee: number; grade: number }> = []
  for (const sessionId of matchingSessionIds) {
    for (const s of owned) {
      if (!existingMap.has(`${sessionId}-${s.id}`)) {
        toCreate.push({ sessionId, studentId: s.id, fee: s.tuitionFee, grade: s.grade })
      }
    }
  }

  // 5. Create missing records
  if (toCreate.length > 0) {
    await db.sessionStudent.createMany({
      data: toCreate,
      skipDuplicates: true,
    })
  }

  return { updatedSessions: matchingSessionIds.length }
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

export async function addStudentsToSession(
  db: PrismaClient,
  userId: number,
  sessionId: number,
  studentIds: number[]
): Promise<SessionDTO> {
  const session = await db.teachingSession.findUnique({ where: { id: sessionId } })
  assertOwnership(session, userId)

  // Verify all students belong to the user and get fees
  const studentFees = await assertStudentsOwned(db, userId, studentIds)

  // Sync delta: chỉ xóa HS bị bỏ, chỉ thêm HS mới — giữ nguyên điểm danh HS còn lại
  await db.$transaction(async (tx) => {
    await syncSessionStudents(tx, sessionId, studentFees)
  })

  const updated = await db.teachingSession.findUnique({
    where: { id: sessionId },
    include: {
      subject: true,
      sessionStudents: { include: { student: true } },
    },
  })
  return toDTO(updated!)
}

export async function removeStudentFromSession(
  db: PrismaClient,
  userId: number,
  sessionId: number,
  studentId: number
): Promise<SessionDTO> {
  const session = await db.teachingSession.findUnique({ where: { id: sessionId } })
  assertOwnership(session, userId)

  await db.sessionStudent.delete({
    where: { sessionId_studentId: { sessionId, studentId } },
  })

  const updated = await db.teachingSession.findUnique({
    where: { id: sessionId },
    include: {
      subject: true,
      sessionStudents: { include: { student: true } },
    },
  })
  return toDTO(updated!)
}

export async function checkBulkCreateConflicts(
  db: PrismaClient,
  userId: number,
  input: SessionBulkCreateInput
): Promise<Array<{ date: string; conflict: string }>> {
  const start = parseSessionDate(input.startDate)
  const end = parseSessionDate(input.endDate)
  const startTime = parseTimeToDate(input.startTime)
  const endTime = parseTimeToDate(input.endTime)

  const existingSessions = await db.teachingSession.findMany({
    where: {
      userId,
      sessionDate: { gte: start, lte: end },
    },
    select: {
      title: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      subject: { select: { name: true } },
    },
  })

  const conflicts: Array<{ date: string; conflict: string }> = []
  const currentDate = new Date(start)
  while (currentDate <= end) {
    const VN_dayIndex = (currentDate.getUTCDay() + 6) % 7

    if (input.weekdays.includes(VN_dayIndex)) {
      const overlap = existingSessions.find((s) => {
        const sameDay = s.sessionDate.getTime() === currentDate.getTime()
        if (!sameDay) return false
        return (
          s.startTime.getTime() < endTime.getTime() &&
          s.endTime.getTime() > startTime.getTime()
        )
      })

      if (overlap) {
        const label = overlap.title 
          ? `"${overlap.title}" (${overlap.subject.name})`
          : `Lớp ${overlap.subject.name} (${formatTime(overlap.startTime)}–${formatTime(overlap.endTime)})`
        
        conflicts.push({
          date: dayjs(currentDate).format("DD/MM/YYYY"),
          conflict: label,
        })
      }
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return conflicts
}

export async function bulkCreateSessions(
  db: PrismaClient,
  userId: number,
  input: SessionBulkCreateInput
): Promise<{ created: number; skipped: number }> {
  await assertSubjectOwned(db, userId, input.subjectId)

  let studentFees: Array<{ id: number; tuitionFee: number; grade: number }> = []
  if (input.studentIds) {
    studentFees = await assertStudentsOwned(db, userId, input.studentIds)
  }

  const start = parseSessionDate(input.startDate)
  const end = parseSessionDate(input.endDate)
  const startTime = parseTimeToDate(input.startTime)
  const endTime = parseTimeToDate(input.endTime)

  // Fetch all potentially conflicting sessions at once
  const existingSessions = await db.teachingSession.findMany({
    where: {
      userId,
      sessionDate: { gte: start, lte: end },
    },
    select: {
      id: true,
      title: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
    },
  })

  let createdCount = 0
  let skippedCount = 0

  const toCreate: Array<{
    sessionDate: Date
    startTime: Date
    endTime: Date
    subjectId: number
    title: string | null
    notes: string | null
  }> = []

  const currentDate = new Date(start)
  while (currentDate <= end) {
    const VN_dayIndex = (currentDate.getUTCDay() + 6) % 7

    if (input.weekdays.includes(VN_dayIndex)) {
      // Check overlap in-memory
      const overlap = existingSessions.find((s) => {
        const sameDay = s.sessionDate.getTime() === currentDate.getTime()
        if (!sameDay) return false

        // start_a < end_b AND end_a > start_b
        return (
          s.startTime.getTime() < endTime.getTime() &&
          s.endTime.getTime() > startTime.getTime()
        )
      })

      if (overlap) {
        skippedCount++
      } else {
        toCreate.push({
          sessionDate: new Date(currentDate),
          startTime,
          endTime,
          subjectId: input.subjectId,
          title: input.title ?? null,
          notes: input.notes ?? null,
        })
      }
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  if (toCreate.length > 0) {
    await db.$transaction(async (tx) => {
      const sessions = await tx.teachingSession.createManyAndReturn({
        data: toCreate.map((data) => ({
          ...data,
          userId,
        })),
      })

      if (studentFees.length > 0) {
        const sessionStudentsData = sessions.flatMap((session) =>
          studentFees.map((sf) => ({
            sessionId: session.id,
            studentId: sf.id,
            fee: sf.tuitionFee,
            grade: sf.grade,
          }))
        )
        await tx.sessionStudent.createMany({
          data: sessionStudentsData,
        })
      }
      createdCount = sessions.length
    }, {
      timeout: 5000,
    })
  }

  return { created: createdCount, skipped: skippedCount }
}

export async function bulkDeleteFutureSessions(
  db: PrismaClient,
  userId: number,
  referenceSessionId: number
): Promise<{ deleted: number }> {
  const ref = await db.teachingSession.findUnique({
    where: { id: referenceSessionId },
  })
  assertOwnership(ref, userId)

  // Dùng raw SQL để xử lý DOW (Day of Week) chính xác và nhanh
  // Lưu ý: PostgreSQL DOW: 0=Sunday, 1=Monday...
  // Chúng ta cần lấy DOW của reference date
  const result = await db.$executeRaw`
    DELETE FROM teaching_sessions
    WHERE user_id = ${userId}
      AND subject_id = ${ref.subjectId}
      AND start_time = ${ref.startTime}::time
      AND end_time = ${ref.endTime}::time
      AND session_date >= ${ref.sessionDate}::date
      AND EXTRACT(DOW FROM session_date) = EXTRACT(DOW FROM ${ref.sessionDate}::date)
  `

  return { deleted: Number(result) }
}

export async function bulkUpdateFutureSessions(
  db: PrismaClient,
  userId: number,
  referenceSessionId: number,
  data: SessionUpdateData
): Promise<{ updated: number }> {
  const ref = await db.teachingSession.findUnique({
    where: { id: referenceSessionId },
  })
  assertOwnership(ref, userId)

  const newStart = data.startTime ? parseTimeToDate(data.startTime) : ref.startTime
  const newEnd = data.endTime ? parseTimeToDate(data.endTime) : ref.endTime

  if (newEnd <= newStart) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Giờ kết thúc phải sau giờ bắt đầu",
    })
  }

  // Validate quyền sở hữu môn học mới (nếu đổi) — tránh gán ca sang môn user khác
  if (data.subjectId !== undefined) {
    await assertSubjectOwned(db, userId, data.subjectId)
  }

  // Validate quyền sở hữu HS (nếu đổi). assertStudentsOwned ném NOT_FOUND nếu có
  // ID không tồn tại / thuộc user khác (length không khớp).
  let studentFees: Array<{ id: number; tuitionFee: number; grade: number }> | null = null
  if (data.studentIds !== undefined) {
    studentFees = await assertStudentsOwned(db, userId, data.studentIds)
  }

  // 1. Tìm các ca dạy khớp pattern
  // Dùng raw query để lấy IDs trước
  const sessions = await db.$queryRaw<Array<{ id: number; session_date: Date }>>`
    SELECT id, session_date FROM teaching_sessions
    WHERE user_id = ${userId}
      AND subject_id = ${ref.subjectId}
      AND start_time = ${ref.startTime}::time
      AND end_time = ${ref.endTime}::time
      AND session_date >= ${ref.sessionDate}::date
      AND EXTRACT(DOW FROM session_date) = EXTRACT(DOW FROM ${ref.sessionDate}::date)
  `

  if (sessions.length === 0) return { updated: 0 }

  const sessionIds = sessions.map((s) => s.id)

  // 2. Nếu thay đổi thời gian, cần check overlap cho TỪNG ca
  if (data.startTime || data.endTime) {
    for (const s of sessions) {
      await checkOverlap(db, {
        userId,
        sessionDate: s.session_date,
        startTime: newStart,
        endTime: newEnd,
        excludeId: s.id,
      })
    }
  }

  // 3. Thực hiện update trong transaction
  await db.$transaction(async (tx) => {
    // Nếu có đổi studentIds, đồng bộ DELTA cho TỪNG ca — chỉ thêm HS mới / gỡ HS
    // bị bỏ, GIỮ NGUYÊN điểm danh/ghi chú/học phí của HS đã có. Tránh kiểu
    // xóa-sạch-tạo-lại làm reset toàn bộ điểm danh của mọi ca tương lai.
    if (studentFees !== null) {
      for (const sid of sessionIds) {
        await syncSessionStudents(tx, sid, studentFees)
      }
    }

    await tx.teachingSession.updateMany({
      where: { id: { in: sessionIds } },
      data: {
        ...(data.startTime && { startTime: newStart }),
        ...(data.endTime && { endTime: newEnd }),
        ...(data.subjectId && { subjectId: data.subjectId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  })

  return { updated: sessionIds.length }
}

export async function duplicateSession(
  db: PrismaClient,
  userId: number,
  id: number,
  targetDate: string
): Promise<SessionDTO> {
  const existing = await db.teachingSession.findUnique({
    where: { id },
    include: { sessionStudents: true },
  })
  assertOwnership(existing, userId)

  const newSessionDate = parseSessionDate(targetDate)

  await checkOverlap(db, {
    userId,
    sessionDate: newSessionDate,
    startTime: existing.startTime,
    endTime: existing.endTime,
  })

  const studentIds = existing.sessionStudents.map((ss) => ss.studentId)
  const studentFees = await assertStudentsOwned(db, userId, studentIds)

  const duplicated = await db.teachingSession.create({
    data: {
      userId,
      sessionDate: newSessionDate,
      startTime: existing.startTime,
      endTime: existing.endTime,
      subjectId: existing.subjectId,
      title: existing.title,
      notes: existing.notes,
      ...(studentFees.length > 0
        ? {
            sessionStudents: {
              create: studentFees.map((s) => ({
                studentId: s.id,
                fee: s.tuitionFee,
                grade: s.grade,
              })),
            },
          }
        : {}),
    },
    include: {
      subject: true,
      sessionStudents: { include: { student: true } },
    },
  })

  return toDTO(duplicated)
}

export { parseTimeToDate }
