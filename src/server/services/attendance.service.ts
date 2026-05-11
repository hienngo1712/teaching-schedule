import { TRPCError } from "@trpc/server"
import { type PrismaClient } from "@prisma/client"
import { assertOwnership } from "./_base.service"
import type { AttendanceUpdateInput } from "@/lib/schemas/attendance"
import { getLevel } from "@/lib/utils"
import type { AttendanceDTO } from "@/lib/types/models"

export async function getAttendance(
  db: PrismaClient,
  userId: number,
  sessionId: number
): Promise<AttendanceDTO[]> {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    include: {
      sessionStudents: {
        include: {
          student: true,
        },
      },
    },
  })

  assertOwnership(session, userId)

  return session!.sessionStudents.map((ss) => ({
    studentId: ss.studentId,
    fullName: ss.student.fullName,
    grade: ss.student.grade,
    level: getLevel(ss.student.grade),
    attendance: ss.attendance,
    note: ss.note,
    fee: ss.fee,
  }))
}

export async function updateAttendance(
  db: PrismaClient,
  userId: number,
  input: AttendanceUpdateInput
): Promise<{ success: true }> {
  const session = await db.teachingSession.findUnique({
    where: { id: input.sessionId },
    include: {
      sessionStudents: true,
    },
  })

  assertOwnership(session, userId)

  const sessionStudentIds = new Set(session!.sessionStudents.map((ss) => ss.studentId))

  // Verify all students belong to the session
  for (const att of input.attendances) {
    if (!sessionStudentIds.has(att.studentId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Học sinh ID ${att.studentId} không có trong ca dạy này`,
      })
    }
  }

  // Update attendance records in a transaction
  await db.$transaction(
    input.attendances.map((att) =>
      db.sessionStudent.update({
        where: {
          sessionId_studentId: {
            sessionId: input.sessionId,
            studentId: att.studentId,
          },
        },
        data: {
          attendance: att.attendance,
          note: att.note ?? null,
          ...(att.fee !== undefined && { fee: att.fee }),
        },
      })
    )
  )

  return { success: true }
}
