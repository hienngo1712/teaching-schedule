import { Prisma, type PrismaClient, type ClassUpgradeLog } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { getLevel } from "@/lib/utils"
import { assertOwnership } from "./_base.service"
import type {
  StudentCreateInput,
  StudentFilterInput,
} from "@/lib/schemas/student"
import type { PaginatedResponse } from "@/lib/schemas/common"
import type { StudentDTO } from "@/lib/types/models"

function withLevel<T extends { grade: number }>(s: T): T & { level: "tieu_hoc" | "thcs" } {
  return { ...s, level: getLevel(s.grade) }
}

export async function listStudents(
  db: PrismaClient,
  userId: number,
  filter: StudentFilterInput
): Promise<PaginatedResponse<StudentDTO>> {
  const { page, limit, grade, search, isActive, includeInactive } = filter
  const skip = (page - 1) * limit
  const take = limit

  const where = {
    userId,
    ...(isActive !== undefined
      ? { isActive }
      : includeInactive
      ? {}
      : { isActive: true }),
    ...(grade ? { grade } : {}),
    ...(search
      ? { fullName: { contains: search, mode: "insensitive" as const } }
      : {}),
  }

  const [students, totalCount] = await Promise.all([
    db.student.findMany({
      where,
      orderBy: [{ grade: "asc" }, { fullName: "asc" }],
      skip,
      take,
    }),
    db.student.count({ where }),
  ])

  return {
    items: students.map(withLevel),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  }
}

export async function createStudent(
  db: PrismaClient,
  userId: number,
  input: StudentCreateInput
): Promise<StudentDTO> {
  const student = await db.student.create({
    data: {
      userId,
      fullName: input.fullName,
      grade: input.grade,
      parentPhone: input.parentPhone ?? null,
      parentName: input.parentName ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive,
      tuitionFee: input.tuitionFee,
    },
  })
  return withLevel(student)
}

export async function updateStudent(
  db: PrismaClient,
  userId: number,
  id: number,
  data: Partial<StudentCreateInput>
): Promise<StudentDTO> {
  const existing = await db.student.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  const student = await db.student.update({
    where: { id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.grade !== undefined && { grade: data.grade }),
      ...(data.parentPhone !== undefined && {
        parentPhone: data.parentPhone ?? null,
      }),
      ...(data.parentName !== undefined && {
        parentName: data.parentName ?? null,
      }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.tuitionFee !== undefined && { tuitionFee: data.tuitionFee }),
    },
  })
  return withLevel(student)
}

export async function softDeleteStudent(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<{ success: true }> {
  const existing = await db.student.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  await db.student.update({
    where: { id },
    data: { isActive: false },
  })
  return { success: true }
}

export async function upgradeAllClasses(
  db: PrismaClient,
  userId: number,
  trigger: "auto" | "manual"
): Promise<{ upgradedCount: number; deactivatedCount: number; year: number }> {
  const year = new Date().getFullYear()
  const conflictError = new TRPCError({
    code: "CONFLICT",
    message: `Bạn đã nâng lớp toàn bộ học sinh trong năm ${year} rồi.`,
  })

  try {
    return await db.$transaction(async (tx) => {
      // Idempotency check INSIDE the transaction to avoid TOCTOU race where
      // two concurrent callers both pass the check and one hits the unique
      // constraint with an opaque P2002 error.
      const existing = await tx.classUpgradeLog.findUnique({
        where: { userId_year: { userId, year } },
      })
      if (existing) throw conflictError

      // Collect grade-9 student IDs BEFORE any updates to avoid catching
      // grade-8 students that were just incremented to 9
      const grade9Students = await tx.student.findMany({
        where: { userId, isActive: true, grade: 9 },
        select: { id: true },
      })
      const grade9Ids = grade9Students.map((s) => s.id)

      const upgraded = await tx.student.updateMany({
        where: { userId, isActive: true, grade: { gte: 1, lte: 8 } },
        data: { grade: { increment: 1 } },
      })
      const deactivated = grade9Ids.length > 0
        ? await tx.student.updateMany({
            where: { id: { in: grade9Ids } },
            data: { isActive: false },
          })
        : { count: 0 }
      await tx.classUpgradeLog.create({
        data: {
          userId,
          year,
          trigger,
          upgradedCount: upgraded.count,
          deactivatedCount: deactivated.count,
        },
      })
      return {
        upgradedCount: upgraded.count,
        deactivatedCount: deactivated.count,
        year,
      }
    })
  } catch (err) {
    // Defense-in-depth: if two callers race past the in-tx check (extremely
    // rare given short transaction window), the unique constraint catches it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw conflictError
    }
    throw err
  }
}

export async function getUpgradeLogThisYear(
  db: PrismaClient,
  userId: number
): Promise<ClassUpgradeLog | null> {
  return db.classUpgradeLog.findUnique({
    where: { userId_year: { userId, year: new Date().getFullYear() } },
  })
}
