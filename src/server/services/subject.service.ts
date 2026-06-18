import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient, type Subject } from "@prisma/client"
import { assertOwnership } from "./_base.service"
import type {
  SubjectCreateInput,
  SubjectFilterInput,
} from "@/lib/schemas/subject"

export async function listSubjects(
  db: PrismaClient,
  userId: number,
  filter: SubjectFilterInput
): Promise<Subject[]> {
  return db.subject.findMany({
    where: {
      userId,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

export async function createSubject(
  db: PrismaClient,
  userId: number,
  input: SubjectCreateInput
): Promise<Subject> {
  try {
    return await db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.subject.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.subject.create({
        data: {
          userId,
          name: input.name,
          color: input.color,
          isDefault: input.isDefault,
          sortOrder: input.sortOrder,
        },
      })
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tên môn học đã tồn tại",
      })
    }
    throw e
  }
}

export async function updateSubject(
  db: PrismaClient,
  userId: number,
  id: number,
  data: Partial<SubjectCreateInput>
): Promise<Subject> {
  const existing = await db.subject.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  try {
    return await db.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.subject.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
      }
      return tx.subject.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      })
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tên môn học đã tồn tại",
      })
    }
    throw e
  }
}

export async function softDeleteSubject(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<{ success: true }> {
  const existing = await db.subject.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  // Không cho xóa nếu đang có session dùng môn này
  const inUse = await db.teachingSession.count({ where: { subjectId: id, userId } })
  if (inUse > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Không thể xóa môn đang được dùng bởi ca dạy",
    })
  }

  // Không cho xóa subject active cuối cùng
  const remaining = await db.subject.count({
    where: { userId, isActive: true, NOT: { id } },
  })
  if (remaining === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Không thể xóa môn cuối cùng",
    })
  }

  await db.subject.update({ where: { id }, data: { isActive: false } })
  return { success: true }
}
