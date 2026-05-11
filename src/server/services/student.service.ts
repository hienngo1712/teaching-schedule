import type { PrismaClient } from "@prisma/client"
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
  const { page, limit, grade, search, isActive } = filter
  const skip = (page - 1) * limit
  const take = limit

  const where = {
    userId,
    ...(isActive !== undefined ? { isActive } : { isActive: true }),
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
